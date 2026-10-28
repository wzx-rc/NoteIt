// Builds PLUM as one HTML file: the artifact page (no document skeleton) and a standalone copy.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), src = join(here, 'src'), out = join(here, 'dist');
mkdirSync(out, { recursive: true });
const rd = f => readFileSync(join(src, f), 'utf8');
const PKG_VERSION = JSON.parse(readFileSync(join(here, 'electron', 'hub', 'package.json'), 'utf8')).version;
// '0.0.1-beta' is shown as 'Beta 0.0.1'
const VERSION = /-beta$/.test(PKG_VERSION) ? 'Beta ' + PKG_VERSION.replace(/-beta$/, '') : PKG_VERSION.replace(/\.0$/, '');
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
const face = (fam, file, w, range) => `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${rd(file).trim()}) format("woff2");unicode-range:${range}}`;
const fonts = [face('Figtree', 'figtree-latin.b64', '300 900', LATIN), face('Figtree', 'figtree-latin-ext.b64', '300 900', LATIN_EXT), face('Caveat', 'caveat-latin.b64', '400 700', LATIN), face('Caveat', 'caveat-latin-ext.b64', '400 700', LATIN_EXT)].join('\n');
/* themes: every folder of src/themes is one theme (a folder starting with _ is left out, like the _modele template).
   theme.js (then the theme's other .js) comes right after 00-util.js (which defines defineTheme), theme.css then the other .css after style.css.
   "asset:<file>" in a theme's js or css becomes a data: URL of src/themes/<id>/assets/<file>. */
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif', woff2: 'font/woff2' };
const themesDir = join(src, 'themes');
const themes = readdirSync(themesDir).filter(d => !d.startsWith('_') && statSync(join(themesDir, d)).isDirectory()).sort();
const inlineAssets = (id, text) => text.replace(/asset:([\w./-]+)/g, (m, f) => {
  const file = join(themesDir, id, 'assets', f), ext = f.split('.').pop().toLowerCase();
  if (!existsSync(file)) throw new Error(`theme ${id}: missing asset ${f}`);
  if (!MIME[ext]) throw new Error(`theme ${id}: unknown asset type ${f}`);
  return `data:${MIME[ext]};base64,${readFileSync(file).toString('base64')}`;
});
/* a theme can bring more js than its theme.js (e.g. its own colour wheel): theme.js first, then the others by name */
const themeJs = themes.flatMap(id => readdirSync(join(themesDir, id)).filter(f => f.endsWith('.js')).sort((a, b) => (b === 'theme.js') - (a === 'theme.js') || a.localeCompare(b)).map(f => `/* ---- themes/${id}/${f} ---- */\n` + inlineAssets(id, rd(`themes/${id}/${f}`)))).join('\n');
/* a theme's css is split in two: the rules every page needs (the theme's card in Réglages, :root images, anything not tied to
   [data-skin]) stay in the page's style; the rest waits in a <script type="text/css"> and applyTheme puts only the active
   theme's in a style of its own, so the browser never matches the rules of the eight other themes (0.2.24) */
function splitCss(text) {
  const g = [], sc = []; let i = 0, n = text.length;
  while (i < n) {
    let j = i, depth = 0, q = null;
    for (; j < n; j++) {
      const c = text[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '/' && text[j + 1] === '*') { const e = text.indexOf('*/', j + 2); j = e < 0 ? n : e + 1; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { j++; break; } }
      else if (c === ';' && depth === 0) { j++; break; }
    }
    const block = text.slice(i, j); i = j;
    const head = block.replace(/\/\*[\s\S]*?\*\//g, '').split('{')[0];
    if (!block.trim()) continue;
    (/data-skin/.test(head) || (/^\s*@(media|supports|container)/.test(head) && /data-skin/.test(block)) ? sc : g).push(block);
  }
  return { global: g.join('\n'), scoped: sc.join('\n') };
}
const themeParts = themes.map(id => { const all = readdirSync(join(themesDir, id)).filter(f => f.endsWith('.css')).sort((a, b) => (b === 'theme.css') - (a === 'theme.css') || a.localeCompare(b)).map(f => splitCss(inlineAssets(id, rd(`themes/${id}/${f}`)))); return { id, global: all.map(x => x.global).join('\n'), scoped: all.map(x => x.scoped).join('\n') }; });
const themeCss = themeParts.map(t => t.global);
const themeLazy = themeParts.map(t => `<script type="text/css" id="thcss-${t.id}">\n${t.scoped}\n</script>`).join('\n');
const jsFiles = readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
const js = `const APP_VERSION = ${JSON.stringify(VERSION)};\n` + jsFiles.map(f => `/* ---- ${f} ---- */\n` + rd('js/' + f) + (f.startsWith('00-') ? '\n' + themeJs : '')).join('\n');
const css = [rd('style.css'), ...themeCss].join('\n');
/* the PLUM logo: src/brand/plum-mark.png (the feather alone) and plum-icon.jpg (the app icon), used in css as var(--plum-mark) / var(--plum-icon) */
const brandUrl = f => `data:${MIME[f.split('.').pop()]};base64,${readFileSync(join(src, 'brand', f)).toString('base64')}`;
const brandCss = `:root{--plum-mark:url(${brandUrl('plum-mark.png')});--plum-icon:url(${brandUrl('plum-icon.jpg')})}`;
const head = `<title>PLUM ${VERSION}</title>\n<style>\n${fonts}\n${brandCss}\n${css}\n</style>`;
const body = `${themeLazy}\n${rd('body.html').replace('{{VERSION}}', VERSION)}\n<script>\n(() => {\n${js}\n})();\n</script>`;
writeFileSync(join(out, 'plum.html'), `${head}\n${body}\n`);
writeFileSync(join(out, 'plum-standalone.html'), `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<link rel="icon" href="${brandUrl('plum-mark.png')}">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log('built', themes.join(', '), (readFileSync(join(out, 'plum.html')).length / 1024).toFixed(0) + ' KB');
