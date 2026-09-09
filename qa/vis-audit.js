// P3 visual audit — Sparkler Exit Lab
const { chromium } = require('/root/node_modules/playwright');
const fs = require('fs');
const OUT = '/root/sparkler-lab/qa/shots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { tag: 'desk', width: 1440, height: 900 },
  { tag: 'tab',  width: 768,  height: 1024 },
  { tag: 'mob',  width: 390,  height: 844 },
];
const URL = 'http://127.0.0.1:8123/index.html';

function shot(page, name) {
  return page.screenshot({ path: `${OUT}/vis-${name}.png`, fullPage: false });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

    // fresh state
    await page.goto('about:blank');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.clear();
      delete window.__sparklerLab;
      delete window.__sparklerEditor;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // 1 hero fold
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await shot(page, `hero-${vp.tag}`);
    report.push(`[${vp.tag}] hero shot done`);

    // 2 explain section (incl SVG diagram)
    await page.evaluate(() => {
      const el = document.getElementById('s1explain');
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(300);
    await shot(page, `explain-${vp.tag}`);
    // SVG diagram closeup
    const svg = await page.$('#s2shoot svg');
    if (svg) {
      await svg.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await shot(page, `diagram-${vp.tag}`);
    } else {
      report.push(`[${vp.tag}] !! no svg in #s2shoot`);
    }

    // 3 lab empty state
    await page.evaluate(() => {
      const el = document.getElementById('s2lab');
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(300);
    await shot(page, `lab-empty-${vp.tag}`);

    // 4 lab with analysis populated (sample-open button)
    const btn = await page.$('[data-sample="tunnel-drag"]');
    if (btn) {
      await btn.click();
      await page.waitForFunction(
        () => {
          const c = document.getElementById('histCanvas');
          return c && c.width > 0;
        },
        { timeout: 10000 }
      ).catch(() => report.push(`[${vp.tag}] !! hist canvas wait timeout`));
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const el = document.getElementById('s2lab');
        if (el) el.scrollIntoView();
      });
      await shot(page, `lab-analyzed-${vp.tag}`);
      report.push(`[${vp.tag}] lab analyzed done`);
    } else {
      report.push(`[${vp.tag}] !! no [data-sample] button found`);
    }

    // 5 head library
    await page.evaluate(() => {
      const el = document.getElementById('s3heads');
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(500);
    // verify 6 canvases painted
    const painted = await page.evaluate(() => {
      const cs = [...document.querySelectorAll('#s3heads canvas.thumb')];
      return cs.map((c) => {
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let lit = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 20 || d[i+1] > 20 || d[i+2] > 20) lit++;
          }
          return lit / (c.width * c.height);
        } catch (e) { return -1; }
      });
    });
    report.push(`[${vp.tag}] head thumb painted fractions: ${painted.map((p) => p.toFixed(3)).join(',')}`);
    await shot(page, `heads-${vp.tag}`);

    // 6 editor with 3 heads placed on couple-walk
    if (vp.tag === 'desk') {
      await page.evaluate(() => {
        document.querySelectorAll('.sample-open').forEach((b) => {
          if (b.getAttribute('data-sample') === 'couple-walk') b.click();
        });
      });
      // wait for editor image loaded
      await page.waitForFunction(
        () => window.__sparklerEditor && typeof window.__sparklerEditor === 'object',
        { timeout: 10000 }
      ).catch(() => report.push('!! sparklerEditor object not exposed'));
      // click sendToEditor if present
      const send = await page.$('#sendToEditor');
      if (send) {
        await send.scrollIntoViewIfNeeded();
        await send.click();
      }
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        const el = document.getElementById('s4editor');
        if (el) el.scrollIntoView();
      });
      await page.waitForTimeout(300);
      const box = await page.$eval('#editorCanvas', (c) => {
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      if (!box || box.w < 10) report.push(`!! editorCanvas box ${JSON.stringify(box)}`);
      // place 3 heads at distinct points (avoid handles)
      const pts = [
        { fx: 0.32, fy: 0.30 },
        { fx: 0.60, fy: 0.42 },
        { fx: 0.78, fy: 0.25 },
      ];
      const placed = [];
      for (const p of pts) {
        await page.mouse.click(box.x + p.fx * box.w, box.y + p.fy * box.h);
        await page.waitForTimeout(250);
        placed.push({ ...p });
      }
      // verify layers via canvas pixel diff or window.__sparklerEditor
      const layerInfo = await page.evaluate(() => {
        try {
          const ed = window.__sparklerEditor;
          if (ed && typeof ed.layers === 'function') return ed.layers();
          if (ed && ed.getLayers) return ed.getLayers();
        } catch (e) {}
        return null;
      });
      report.push(`desk editor layers: ${layerInfo ? JSON.stringify(layerInfo.length) : 'unknown'} (clicks at ${JSON.stringify(pts)})`);
      await shot(page, `editor-3heads-desk`);
      // also a before/after toggle shot if available
      const ba = await page.$('#baToggle');
      if (ba) {
        await ba.click();
        await page.waitForTimeout(400);
        await shot(page, `editor-beforeafter-desk`);
        await ba.click(); // restore
        await page.waitForTimeout(300);
      }
    }

    // 7 gallery
    await page.evaluate(() => {
      const el = document.getElementById('s5gallery');
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(600);
    // image load check
    const imgInfo = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('#s5gallery img')];
      return imgs.map((i) => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0, nw: i.naturalWidth, dispW: Math.round(i.getBoundingClientRect().width), dispH: Math.round(i.getBoundingClientRect().height) }));
    });
    report.push(`[${vp.tag}] gallery imgs: ${JSON.stringify(imgInfo)}`);
    await shot(page, `gallery-${vp.tag}`);

    // 8 method
    await page.evaluate(() => {
      const el = document.getElementById('s5method');
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(300);
    await shot(page, `method-${vp.tag}`);

    // 9 console errors
    if (errors.length) report.push(`[${vp.tag}] console errors: ${errors.join(' | ')}`);
    else report.push(`[${vp.tag}] no console errors`);

    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync('/root/sparkler-lab/qa/vis-run.log', report.join('\n'));
  console.log(report.join('\n'));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });