
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => console.log('[console:' + m.type() + ']', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));

await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'domcontentloaded' });
// Inspect the live DOM's script tags before any waiting
const tag = await page.evaluate(() => [...document.querySelectorAll('script')].map(s => ({
  src: s.getAttribute('src'), type: s.type, inBody: document.body.contains(s)
})));
console.log('SCRIPT TAGS:', JSON.stringify(tag, null, 1));

// Manually re-execute the module tag as the browser would if it had been missed
const manual = await page.evaluate(async () => {
  const s = document.querySelector('script[type="module"][src*="app.js"]');
  if (!s) return 'no-tag';
  // does a fresh dynamic import of app.js run boot?
  try {
    await import('/assets/js/app.js?manual=1');
    return 'manual import done';
  } catch (e) { return 'manual import fail: ' + e.message; }
});
console.log('MANUAL:', manual);
await page.waitForTimeout(400);
console.log('after manual, bundle:', await page.evaluate(() => !!window.__sparklerLab));
await browser.close();
