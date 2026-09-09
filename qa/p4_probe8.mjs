
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => console.log('[console:' + m.type() + ']', m.text()));
await page.goto('http://127.0.0.1:8123/_probe.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
console.log('probe:', JSON.stringify(await page.evaluate(() => ({
  probeRan: window.__probeRan || null, bootRan: !!window.__bootRan, mount: window.__toastMountTest || null,
}))));
await browser.close();
