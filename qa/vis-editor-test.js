// Final editor run: absolute-page-coordinate clicks + before/after shots
const { chromium } = require('/root/node_modules/playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:8123/index.html';
const OUT = '/root/sparkler-lab/qa/shots';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const rep = [];

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
  }, { timeout: 12000 }).catch(() => rep.push('!! baseSize never set'));

  // Do NOT scroll. Compute absolute page coords and dispatch synthetic pointer events.
  const placed = await page.evaluate(() => {
    const c = document.getElementById('editorCanvas');
    const r = c.getBoundingClientRect();
    const pts = [{ fx: 0.30, fy: 0.28 }, { fx: 0.62, fy: 0.40 }, { fx: 0.80, fy: 0.22 }];
    const out = [];
    for (const p of pts) {
      const cx = r.left + p.fx * r.width;
      const cy = r.top + p.fy * r.height;
      const ev = new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, composed: true,
        clientX: cx, clientY: cy, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      });
      c.dispatchEvent(ev);
      const up = new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, composed: true,
        clientX: cx, clientY: cy, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse', pointerId1: 1,
      });
      c.dispatchEvent(up);
      out.push({ cx: Math.round(cx), cy: Math.round(cy) });
    }
    return out;
  });
  rep.push('dispatched: ' + JSON.stringify(placed));
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => window.__sparklerEditor.state());
  rep.push('layers: ' + st.length + ' ' + JSON.stringify(st.map((l) => ({ k: l.kind, x: +l.x.toFixed(2), y: +l.y.toFixed(2), size: l.size }))));

  // scroll editor into view and screenshot
  await page.evaluate(() => {
    const el = document.getElementById('s4editor');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/vis-editor-3heads-desk.png' });

  // before/after
  const ba = await page.$('#baToggle');
  if (ba) {
    await ba.scrollIntoViewIfNeeded();
    await ba.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + '/vis-editor-beforeafter-desk.png' });
    rep.push('before/after shot');
  }
  await ctx.close();

  // MOBILE editor (tap place)
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto('about:blank');
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.evaluate(() => localStorage.clear());
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(500);
  await p2.evaluate(() => {
    document.querySelectorAll('.sample-open').forEach((b) => {
      if (b.getAttribute('data-sample') === 'couple-walk') b.click();
    });
  });
  await p2.waitForFunction(() => {
    const w = window.__sparklerEditor && window.__sparklerEditor.baseSize();
    return w && w.w > 0;
  }, { timeout: 12000 }).catch(() => rep.push('!! mob baseSize never set'));
  await p2.evaluate(() => {
    const c = document.getElementById('editorCanvas');
    const r = c.getBoundingClientRect();
    const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.left + 0.4 * r.width, clientY: r.top + 0.3 * r.height, button: 0, buttons: 1, pointerId: 2, pointerType: 'touch' });
    c.dispatchEvent(ev);
    const up = new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: r.left + 0.4 * r.width, clientY: r.top + 0.3 * r.height, button: 0, buttons: 0, pointerId: 2, pointerType: 'touch' });
    c.dispatchEvent(up);
  });
  await p2.waitForTimeout(500);
  const st2 = await p2.evaluate(() => window.__sparklerEditor.state());
  rep.push('mobile layers: ' + st2.length);
  await p2.evaluate(() => {
    const el = document.getElementById('s4editor');
    if (el) el.scrollIntoView();
  });
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: OUT + '/vis-editor-mob.png' });
  await ctx2.close();

  await browser.close();
  fs.writeFileSync('/root/sparkler-lab/qa/vis-editor.log', rep.join('\n'));
  console.log(rep.join('\n'));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });