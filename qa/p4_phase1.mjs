
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8123/index.html';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });

// --- gate (a): mobile 390 stacked settings table ---
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
mob.on('pageerror', e => errors.push('mob pageerror: ' + e.message));
await mob.goto(BASE, { waitUntil: 'networkidle' });
await mob.evaluate(() => document.getElementById('s2shoot').scrollIntoView());
await mob.waitForTimeout(700);
await mob.screenshot({ path: '/root/sparkler-lab/qa/shots/p4-mobile-s2shoot-stacked.png', fullPage: false });

const noCut = await mob.evaluate(() => {
  const wrap = document.querySelector('#s2shoot .s2-tablewrap');
  const table = wrap.querySelector('table');
  const wrapRect = wrap.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const overflowCut = tableRect.right > wrapRect.right + 1;
  const stacked = getComputedStyle(table).display === 'block' &&
                  getComputedStyle(wrap).overflowX === 'visible';
  const headHidden = getComputedStyle(wrap.querySelector('thead')).display === 'none';
  const cards = [...wrap.querySelectorAll('tbody tr')];
  const cardOk = cards.length === 6 && cards.every(tr => getComputedStyle(tr).display === 'block');
  const docCut = document.documentElement.scrollWidth <= window.innerWidth + 1;
  return { overflowCut, stacked, headHidden, cards: cards.length, cardOk, docCut,
           wrapW: Math.round(wrapRect.width), tableW: Math.round(tableRect.width) };
});
console.log('GATE-A stacked check:', JSON.stringify(noCut));

const svgWrap = await mob.evaluate(() => {
  const d = document.querySelector('#s2shoot .s2-diagram');
  return { overflowX: getComputedStyle(d).overflowX, minW: getComputedStyle(d.querySelector('svg')).minWidth };
});
console.log('GATE-A svg wrap:', JSON.stringify(svgWrap));

// --- gate (b): head-card click -> headSelect changes + toast ---
const headVal0 = await page.evaluate(() => document.getElementById('headSelect').value);
await page.evaluate(() => { window.__toastSeen = null;
  const t = document.getElementById('labToast');
  new MutationObserver(() => { window.__toastSeen = t.textContent; }).observe(t, { attributes: true, childList: true, characterData: true, subtree: true });
});
await page.evaluate(() => document.querySelectorAll('#s3heads .headCard')[1].click());
await page.waitForTimeout(300);
const headVal1 = await page.evaluate(() => document.getElementById('headSelect').value);
const toastTxt = await page.evaluate(() => document.getElementById('labToast').textContent);
const toastVis = await page.evaluate(() => document.getElementById('labToast').classList.contains('is-visible'));
const selAt = await page.evaluate(() => {
  const s = document.getElementById('s4editor');
  const r = s.getBoundingClientRect();
  return { top: Math.round(r.top), vis: r.top >= 0 && r.top < window.innerHeight };
});
console.log('GATE-B headSelect:', headVal0, '->', headVal1, '| toast:', JSON.stringify(toastTxt), 'visible:', toastVis, '| editor in view:', JSON.stringify(selAt));
await page.screenshot({ path: '/root/sparkler-lab/qa/shots/p4-headcard-click-toast.png' });

// --- gate (c): sample-load toast + aligned scroll + thumb ---
await page.evaluate(() => { window.scrollTo(0, 0); });
await page.evaluate(() => {
  window.__toastSeen = null;
  const t = document.getElementById('labToast');
  new MutationObserver(() => { window.__toastSeen = t.textContent; }).observe(t, { attributes: true, childList: true, characterData: true, subtree: true });
});
await page.click('#s5gallery .sample-open[data-sample="tunnel-drag"]');
await page.waitForTimeout(2500);
const st = await page.evaluate(() => {
  const tb = document.querySelector('#s4editor .editor-toolbar');
  const cv = document.getElementById('editorCanvas');
  const tr = tb.getBoundingClientRect(), cr = cv.getBoundingClientRect();
  const vw = window.innerHeight;
  return {
    toast: document.getElementById('labToast').textContent,
    toastVisible: document.getElementById('labToast').classList.contains('is-visible'),
    toolbarTop: Math.round(tr.top), toolbarBottom: Math.round(tr.bottom),
    canvasTop: Math.round(cr.top), canvasBottom: Math.round(cr.bottom), vw,
    toolbarInView: tr.top >= 0 && tr.bottom <= vw,
    canvasVisible: cr.top < vw && cr.bottom > 0,
    thumb: !!document.getElementById('labThumb'),
    thumbImg: (document.querySelector('#labThumb img') || {}).src ? 'yes' : 'no',
    editorCanvasHidden: document.getElementById('editorCanvas').hidden,
    score: document.getElementById('scoreNum').textContent,
    analysis: window.__sparklerLab && window.__sparklerLab.analysis ? window.__sparklerLab.analysis.total : null
  };
});
console.log('GATE-C sample load:', JSON.stringify(st));
await page.screenshot({ path: '/root/sparkler-lab/qa/shots/p4-sample-load-toast-scroll.png' });

const thumbW = await page.evaluate(() => {
  const img = document.querySelector('#labThumb img');
  return img ? Math.round(img.getBoundingClientRect().width) : null;
});
console.log('GATE-C thumb width:', thumbW);

// --- gate (d): rec strings in the live lab card ---
await page.evaluate(() => { window.scrollTo(0, 0); });
await page.waitForTimeout(400);
const recs = await page.evaluate(() => [...document.querySelectorAll('#recList li')].map(li => li.textContent));
const recOk = recs.some(r => r.includes('1-5 min')) &&
  !recs.some(r => r.includes('30-60s')) && !recs.some(r => r.includes('1-4s'));
console.log('GATE-D recs:', recOk, JSON.stringify(recs));
await page.screenshot({ path: '/root/sparkler-lab/qa/shots/p4-lab-card-recs.png' });

const lic = await page.evaluate(async () => (await fetch('/LICENSE')).text());
console.log('GATE-F license MIT:', lic.includes('MIT License') && lic.includes('Copyright (c) 2026 Caddy'));

console.log('CONSOLE-ERRORS-SO-FAR:', errors.length, JSON.stringify(errors.slice(0, 5)));

await browser.close();
console.log('PHASE1-DONE');
