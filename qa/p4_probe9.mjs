
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
const h = await page.evaluate(async () => {
  const r = await fetch('/assets/js/app.js', { cache: 'no-store' });
  const t = await r.text();
  const i = t.indexOf('showToast');
  return { len: t.length, hasToast: t.includes("./toast.js"), showToastAt: i,
           readyStateTag: document.readyState,
           scripts: [...document.querySelectorAll('script')].map(s => s.src) };
});
console.log('browser-view of app.js:', JSON.stringify(h));
await browser.close();
