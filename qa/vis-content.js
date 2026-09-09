// A11y/visual readbacks: SVG labels, score colors, recs, table, nav order
const { chromium } = require('/root/node_modules/playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:8123/index.html';

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

  // open tunnel-drag sample to populate lab
  await page.evaluate(() => {
    document.querySelectorAll('.sample-open').forEach((b) => {
      if (b.getAttribute('data-sample') === 'tunnel-drag') b.click();
    });
  });
  await page.waitForTimeout(1500);

  const lab = await page.evaluate(() => {
    const t = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim().slice(0, 220) : null; };
    const recs = [...document.querySelectorAll('#s2lab li, #s2lab .rec, #s2lab [class*="rec"]')].map((e) => e.textContent.trim().slice(0, 100)).filter(Boolean);
    const scoreEls = [...document.querySelectorAll('#s2lab *')].filter((e) => /score/i.test(e.className + '') || /score/i.test(e.id)).map((e) => ({ cls: e.className, txt: e.textContent.trim().slice(0, 80) }));
    return {
      exif: t('.exif, [class*="exif"]'),
      score: scoreEls.slice(0, 4),
      recs: recs.slice(0, 8),
      histCanvas: (() => { const c = document.getElementById('histCanvas'); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 30) lit++; return { w: c.width, h: c.height, litFrac: +(lit / (c.width * c.height)).toFixed(3) }; })(),
      sendBtn: !!document.getElementById('sendToEditor'),
    };
  });
  rep.push('lab: ' + JSON.stringify(lab, null, 1));

  // nav order
  const nav = await page.evaluate(() => [...document.querySelectorAll('nav a')].map((a) => a.textContent.trim() + '→' + a.getAttribute('href')));
  rep.push('nav: ' + nav.join(' | '));

  // heading hierarchy
  const heads = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].map((h) => h.tagName + ':' + h.textContent.trim().slice(0, 50)));
  rep.push('headings:\n' + heads.join('\n'));

  // method section honesty
  const method = await page.evaluate(() => {
    const el = document.getElementById('s5method');
    return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 700) : null;
  });
  rep.push('method: ' + method);

  // footer
  const footer = await page.evaluate(() => { const f = document.querySelector('footer'); return f ? f.textContent.replace(/\s+/g, ' ').slice(0, 200) : null; });
  rep.push('footer: ' + footer);

  // hero CTAs
  const hero = await page.evaluate(() => {
    const el = document.getElementById('s1hero');
    return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 400) : null;
  });
  rep.push('hero: ' + hero);

  // h1..h2 size ratio at mobile
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto('about:blank');
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(500);
  const mob = await p2.evaluate(() => {
    const g = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontSize : null; };
    return {
      h1: g('h1'), h2: g('h2'), body: g('body'),
      heroBtns: [...document.querySelectorAll('#s1hero a, #s1hero button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }),
      dzButtons: [...document.querySelectorAll('#s2lab button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; }),
    };
  });
  rep.push('mobile type/btn: ' + JSON.stringify(mob, null, 1));
  await ctx2.close();
  await ctx.close();

  await browser.close();
  fs.writeFileSync('/root/sparkler-lab/qa/vis-content.log', rep.join('\n'));
  console.log(rep.join('\n'));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });