// Debug: why does pointerdown not place a layer?
const { chromium } = require('/root/node_modules/playwright');
const URL = 'http://127.0.0.1:8123/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log('[console]', m.type(), m.text()));
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

  // instrument pointerdown on canvas
  const probe = await page.evaluate(() => {
    const c = document.getElementById('editorCanvas');
    const st = document.getElementById('stage');
    return {
      canvasHidden: c.hidden,
      canvasW: c.width, canvasH: c.height,
      canvasStyleW: c.style.width,
      rect: c.getBoundingClientRect().toJSON(),
      stagePointerEvents: getComputedStyle(st).pointerEvents,
      canvasPointerEvents: getComputedStyle(c).pointerEvents,
      stageDisplay: getComputedStyle(st).display,
    };
  });
  console.log('PROBE:', JSON.stringify(probe, null, 1));

  await page.evaluate(() => {
    const el = document.getElementById('s4editor');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(400);
  const box = await page.$eval('#editorCanvas', (c) => c.getBoundingClientRect().toJSON());
  // add a temp capture listener
  await page.evaluate(() => {
    window.__pd = 0;
    document.getElementById('editorCanvas').addEventListener('pointerdown', () => { window.__pd++; }, { capture: true });
  });
  await page.mouse.click(box.x + 0.35 * box.width, box.y + 0.3 * box.height);
  await page.waitForTimeout(500);
  const got = await page.evaluate(() => window.__pd);
  console.log('pointerdown captured:', got);
  const st = await page.evaluate(() => window.__sparklerEditor.state());
  console.log('layers:', st.length, JSON.stringify(st.map((l) => l.kind)));

  // try clicking with mouse.move first (pointerdown/up sequence)
  await page.mouse.move(box.x + 0.55 * box.width, box.y + 0.35 * box.height);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const st2 = await page.evaluate(() => window.__sparklerEditor.state());
  console.log('after down/up layers:', st2.length);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });