// Renders public/og-image.png: the preview image shown when the link is shared in Teams,
// WhatsApp, Slack, iMessage… Run after changing the design: node scripts/make-og-image.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const font = readFileSync('node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2').toString('base64');
const icon = readFileSync('public/icon.svg', 'utf8').replace('<svg ', '<svg width="300" height="300" ');

const html = `<!doctype html><html><head><style>
@font-face { font-family: Fredoka; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 300 700; }
* { margin: 0; box-sizing: border-box; }
body {
  width: 1200px; height: 630px; overflow: hidden;
  font-family: Fredoka, sans-serif; color: #2b1d14;
  background: radial-gradient(circle at 15% 10%, #ffe7b0 0, transparent 45%),
              radial-gradient(circle at 100% 100%, #ffd98f 0, transparent 50%), #fff3d6;
  display: flex; align-items: center; gap: 56px; padding: 0 80px;
}
.icon { flex-shrink: 0; filter: drop-shadow(0 12px 24px rgba(90, 45, 10, .22)); transform: rotate(-4deg); }
.title { font-size: 128px; font-weight: 700; color: #b5651d; line-height: 1; letter-spacing: -2px; }
.tagline { font-size: 44px; font-weight: 600; margin: 18px 0 34px; line-height: 1.15; }
.chips { display: flex; gap: 12px; }
.chip { font-size: 25px; font-weight: 600; background: #fff; border: 3px solid #ecd9b8; border-radius: 999px; padding: 9px 18px; white-space: nowrap;
        box-shadow: 0 4px 0 rgba(60, 30, 5, .15); }
.chip.accent { background: #ff5a36; color: #fff; border-color: #ff5a36; }
</style></head><body>
  <div class="icon">${icon}</div>
  <div>
    <div class="title">Pinocchio</div>
    <div class="tagline">The bluffing game<br>about your colleagues</div>
    <div class="chips">
      <span class="chip accent">📱 Join on your phone</span>
      <span class="chip">🤥 Lie</span>
      <span class="chip">🔍 Find the truth</span>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('✅ public/og-image.png written');
