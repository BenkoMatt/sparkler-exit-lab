// Verify editor actually has 3 layers placed (desk) + mobile overflow checks
const { chromium } = require('/root/node_modules/playwright');
const fs = require('fs');
const OUT = '/root/sparkler-lab/qa/shots';
const URL = 'http://127.0.0.1:8123/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const rep = [];

  // ---------- DESK: editor layer verification ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('about:blank');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // open couple-walk via gallery button
  await page.evaluate(() => {
    document.querySelectorAll('.sample-open').forEach((b) => {
      if (b.getAttribute('data-sample') === 'couple-walk') b.click();
    });
  });
  // editor.js loads image via sparklerlab:image-loaded; wait for baseSize
  await page.waitForFunction(() => {
    const w = window.__sparklerEditor && window.__sparklerEditor.baseSize();
    return w && w.w > 0;
  }, { timeout: 12000 }).catch(() => rep.push('!! baseSize never set'));

  await page.evaluate(() => {
    const el = document.getElementById('s4editor');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(400);
  const box = await page.$eval('#editorCanvas', (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  rep.push('canvas box: ' + JSON.stringify(box));

  const pts = [{ fx: 0.30, fy: 0.28 }, { fx: 0.62, fy: 0.40 }, { fx: 0.80, fy: 0.22 }];
  for (const p of pts) {
    await page.mouse.click(box.x + p.fx * box.w, box.y + p.fy * box.h);
    await page.waitForTimeout(250);
  }
  const state = await page.evaluate(() => window.__sparklerEditor.state());
  rep.push('layers: ' + JSON.stringify(state.length));
  await page.screenshot({ path: OUT + '/vis-editor-3heads-desk.png' });

  // before/after
  const ba = await page.$('#baToggle');
  if (ba) {
    await ba.scrollIntoViewIfNeeded();
    await ba.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + '/vis-editor-beforeafter-desk.png' });
  }

  // overflow check desk
  const ovf = await page.evaluate(() => {
    const bad = [];
    const w = document.documentElement.clientWidth;
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > w + 2 || r.left < -2)) {
        const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
        bad.push(tag + ' L' + Math.round(r.left) + ' R' + Math.round(r.right));
      }
    });
    return bad.slice(0, 12);
  });
  rep.push('desk overflow: ' + JSON.stringify(ovf));
  await ctx.close();

  // ---------- MOBILE: overflow + tap targets ----------
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto('about:blank');
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.evaluate(() => localStorage.clear());
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(600);
  const ovf2 = await p2.evaluate(() => {
    const bad = [];
    const w = document.documentElement.clientWidth;
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > w + 2 || r.left < -2)) {
        const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
        bad.push(tag + ' L' + Math.round(r.left) + ' R' + Math.round(r.right));
      }
    });
    return bad.slice(0, 15);
  });
  rep.push('mobile overflow: ' + JSON.stringify(ovf2));

  // tap targets
  const taps = await p2.evaluate(() => {
    const small = [];
    document.querySelectorAll('a, button, [role="button"], input, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)) {
        const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
        small.push(tag + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    });
    return small.slice(0, 15);
  });
  rep.push('mobile tap<44px: ' + JSON.stringify(taps));

  // horizontal scroll?
  const hscroll = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  rep.push('mobile h-scroll px: ' + hscroll);
  await ctx2.close();

  await browser.close();
  fs.writeFileSync('/root/sparkler-lab/qa/vis-verify.log', rep.join('\n'));
  console.log(rep.join('\n'));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });