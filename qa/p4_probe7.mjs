
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

// Route: fail the toast.js request to see whether app.js silently dies
await page.route('**/assets/js/toast.js*', route => route.abort());
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
console.log('toast-blocked, bundle:', await page.evaluate(() => !!window.__sparklerLab),
            'errors:', JSON.stringify(errs));
await browser.close();

// Control: no blocking
const b2 = await chromium.launch();
const p2 = await b2.newPage();
const errs2 = [];
p2.on('pageerror', e => errs2.push(e.message));
p2.on('console', m => { if (m.type() === 'error') errs2.push('console: ' + m.text()); });
await p2.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
console.log('unblocked, bundle:', await p2.evaluate(() => !!window.__sparklerLab),
            'errors:', JSON.stringify(errs2));
await b2.close();
