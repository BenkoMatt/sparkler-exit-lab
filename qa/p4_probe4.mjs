
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of ['log', 'debug', 'info', 'warning', 'error']) {
  page.on(t, m => console.log('[PW-' + t + ']', m.text && m.text()));
}
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => console.log('[console:' + m.type() + ']', m.text()));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const st = await page.evaluate(() => ({
  qa: typeof window.__sparklerEditor,
  bundle: !!window.__sparklerLab,
}));
console.log('STATE:', JSON.stringify(st));
await browser.close();
