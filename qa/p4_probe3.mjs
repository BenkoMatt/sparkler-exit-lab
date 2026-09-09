
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
page.on('requestfailed', r => logs.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText));

await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const st = await page.evaluate(() => ({
  qaHook: typeof window.__sparklerEditor,
  labBundle: !!window.__sparklerLab,
  headSel: document.getElementById('headSelect').value,
}));
console.log('STATE:', JSON.stringify(st));

// what does the served page's module graph look like? request the modules as the browser would
const modFetch = await page.evaluate(async () => {
  const r = await fetch('/assets/js/app.js', { cache: 'no-store' });
  const t = await r.text();
  return { imports: [...t.matchAll(/import\s+.+?from\s+'([^']+)'/g)].map(m => m[1]),
           head: t.slice(0, 120) };
});
console.log('app.js imports:', JSON.stringify(modFetch));

console.log('LOGS:', JSON.stringify(logs, null, 1));
await browser.close();
