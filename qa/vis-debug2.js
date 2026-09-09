// Debug2: elementFromPoint at editor click location
const { chromium } = require('/root/node_modules/playwright');
const URL = 'http://127.0.0.1:8123/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('about:blank');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.querySelectorAll('.sample-open').forEach((b) => {
      if (b.getAttribute('data-sample') === 'couple-walk') b.click();
    });
  });
  await page.waitForFunction(() => {
    const w = window.__sparklerEditor && window.__sparklerEditor.baseSize();
    return w && w.w > 0;
  }, { timeout: 12000 });
  await page.evaluate(() => {
    const el = document.getElementById('s4editor');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(400);
  const probe = await page.evaluate(() => {
    const c = document.getElementById('editorCanvas');
    const r = c.getBoundingClientRect();
    const x = r.left + 0.35 * r.width, y = r.top + 0.3 * r.height;
    const el = document.elementFromPoint(x, y);
    const chain = [];
    let n = el;
    while (n && n !== document.body) { chain.push(n.tagName + (n.id ? '#' + n.id : '') + (n.className ? '.' + String(n.className).split(' ')[0] : '')); n = n.parentElement; }
    return {
      x, y,
      hit: el ? el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).slice(0, 40) : 'null',
      chain,
      scrollY: Math.round(window.scrollY),
      canvasRect: { top: r.top, left: r.left, w: r.width, h: r.height },
    };
  });
  console.log(JSON.stringify(probe, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });