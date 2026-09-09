
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const reqs = [];
page.on('request', r => { if (r.url().includes('/assets/js/')) reqs.push(r.url().split('/assets/js/')[1]); });
page.on('response', r => { if (r.url().includes('/assets/js/')) reqs.push(r.url().split('/assets/js/')[1] + ' -> ' + r.status()); });
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
console.log('module requests:', JSON.stringify(reqs, null, 1));
console.log('bundle:', await page.evaluate(() => !!window.__sparklerLab));
await browser.close();
