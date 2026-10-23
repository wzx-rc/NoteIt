// Capture apercu/planche.html en PNG pleine page.
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { chromium } = await import('playwright').catch(() =>
  createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 1200 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(ROOT, 'apercu', 'planche.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: path.join(ROOT, 'apercu', 'planche.png'), fullPage: true });
await browser.close();
console.log('apercu/planche.png');
