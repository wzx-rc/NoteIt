// Rend chaque SVG du pack en PNG transparent avec Chromium (Playwright).
// Les filtres SVG (grain, bords mangés) sont rendus tels qu'un navigateur les affiche.
// Usage : node tools/render.mjs [filtre]   (depuis design/nature-anthracite)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SVG = path.join(ROOT, 'svg');
const PNG = path.join(ROOT, 'png');
const only = process.argv[2] || '';
// Playwright local si présent, sinon l'installation globale
const { chromium } = await import('playwright').catch(() =>
  createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'));

const font = (f) => `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64')}`;
const css = `@font-face{font-family:Figtree;src:url(${font('figtree-latin.woff2')})}
@font-face{font-family:Caveat;src:url(${font('caveat-latin.woff2')})}
html,body{margin:0;background:transparent}svg{display:block}`;

// tailles de sortie : icônes en pixels fixes, le reste en multiples
const scalesFor = (rel) => {
  if (rel.startsWith('icones/')) return [['24', 1], ['48', 2], ['96', 4], ['192', 8]];
  if (rel.startsWith('couleur/') || rel.startsWith('pinceau/') || rel.startsWith('botanique/')) return [['@1x', 1], ['@2x', 2], ['@4x', 4]];
  return [['@1x', 1], ['@2x', 2]];
};

const list = JSON.parse(fs.readFileSync(path.join(SVG, 'liste.json'), 'utf8')).filter((r) => r.includes(only));
const browser = await chromium.launch();
const pages = {};
let n = 0;
for (const rel of list) {
  const src = fs.readFileSync(path.join(SVG, rel), 'utf8');
  const w = +src.match(/width="([\d.]+)"/)[1];
  const h = +src.match(/height="([\d.]+)"/)[1];
  for (const [suffix, scale] of scalesFor(rel)) {
    if (!pages[scale]) {
      const ctx = await browser.newContext({ deviceScaleFactor: scale, viewport: { width: 1200, height: 1200 } });
      pages[scale] = await ctx.newPage();
    }
    const page = pages[scale];
    await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
    await page.setContent(`<!doctype html><style>${css}</style>${src}`);
    await page.evaluate(() => document.fonts.ready);
    const base = rel.replace(/\.svg$/, '');
    const out = path.join(PNG, rel.startsWith('icones/') ? `${base}-${suffix}.png` : `${base}${suffix}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.locator('svg').first().screenshot({ path: out, omitBackground: true });
    n++;
  }
}
await browser.close();
console.log(n, 'PNG');
