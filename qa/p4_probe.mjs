
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
const d = await page.evaluate(() => {
  const card = document.querySelectorAll('#s3heads .headCard')[1];
  return {
    headBound: card ? card.dataset.headBound : 'no-card',
    qaHook: typeof window.__sparklerEditor,
    toast: !!document.getElementById('labToast'),
    headSel: document.getElementById('headSelect') ? document.getElementById('headSelect').value : null,
  };
});
console.log('STATE:', JSON.stringify(d));
await page.evaluate(() => document.querySelectorAll('#s3heads .headCard')[1].click());
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({
  val: document.getElementById('headSelect').value,
  toast: document.getElementById('labToast').textContent,
  vis: document.getElementById('labToast').classList.contains('is-visible'),
}));
console.log('AFTER:', JSON.stringify(after));
console.log('LOGS:', JSON.stringify(logs, null, 1));
await browser.close();
