
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => console.log('[console:' + m.type() + ']', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));

// Direct hash navigation to #s2lab like a real deep link
await page.goto('http://127.0.0.1:8123/index.html#s2lab', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
console.log('with hash, bundle:', await page.evaluate(() => !!window.__sparklerLab));

// Now plain URL again in the SAME browser (new page)
const p2 = await browser.newPage();
await p2.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await p2.waitForTimeout(800);
console.log('fresh page, bundle:', await p2.evaluate(() => !!window.__sparklerLab));
await browser.close();
