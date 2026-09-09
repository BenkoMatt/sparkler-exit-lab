
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
const mod = await page.evaluate(async () => {
  try { await import('/assets/js/editor.js'); return 'reimport-ok'; }
  catch (e) { return 'reimport-fail: ' + e.message; }
});
console.log('reimport:', mod);
const st = await page.evaluate(() => ({
  qaHook: typeof window.__sparklerEditor,
  bound: document.querySelectorAll('#s3heads .headCard[data-head-bound]').length,
  sampleBound: document.querySelectorAll('.sample-open[data-editor-bound]').length,
}));
console.log('STATE:', JSON.stringify(st));
const after = await page.evaluate(async () => {
  document.querySelectorAll('#s3heads .headCard')[1].click();
  await new Promise(r => setTimeout(r, 150));
  return {
    val: document.getElementById('headSelect').value,
    toast: document.getElementById('labToast').textContent,
    vis: document.getElementById('labToast').classList.contains('is-visible'),
  };
});
console.log('AFTER:', JSON.stringify(after));
console.log('LOGS:', JSON.stringify(logs));
await browser.close();
