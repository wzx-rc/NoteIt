// Builds PLUM as one HTML file: the artifact page (no document skeleton) and a standalone copy.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
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
const js = `const APP_VERSION = ${JSON.stringify(VERSION)};\n` + readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort().map(f => `/* ---- ${f} ---- */\n` + rd('js/' + f)).join('\n');
const css = ['style.css', 'skin-nature.css', 'skin-nature-assets.css'].map(rd).join('\n');
const head = `<title>PLUM ${VERSION}</title>\n<style>\n${fonts}\n${css}\n</style>`;
const body = `${rd('body.html').replace('{{VERSION}}', VERSION)}\n<script>\n(() => {\n${js}\n})();\n</script>`;
writeFileSync(join(out, 'plum.html'), `${head}\n${body}\n`);
writeFileSync(join(out, 'plum-standalone.html'), `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log('built', (readFileSync(join(out, 'plum.html')).length / 1024).toFixed(0) + ' KB');
