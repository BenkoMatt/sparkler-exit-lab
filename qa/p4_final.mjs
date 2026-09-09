
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const final = await page.evaluate(() => ({
  toast: !!document.getElementById('labToast'),
  bound: document.querySelectorAll('#s3heads .headCard[data-head-bound]').length,
  bundle: !!window.__sparklerLab,
}));
console.log('FINAL mobile state:', JSON.stringify(final), 'errors:', errs.length, JSON.stringify(errs.slice(0,3)));
await browser.close();
