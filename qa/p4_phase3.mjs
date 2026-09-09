
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8123/index.html';
const browser = await chromium.launch();

// ---- mobile 390: element shot of the stacked table + scroll alignment on sample load ----
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
const mobErrs = [];
mob.on('pageerror', e => mobErrs.push(e.message));
mob.on('console', m => { if (m.type() === 'error') mobErrs.push(m.text()); });
await mob.goto(BASE, { waitUntil: 'networkidle' });

// element screenshot of the whole #s2shoot section (stacked table evidence)
const sec = mob.locator('#s2shoot');
await sec.scrollIntoViewIfNeeded();
await mob.waitForTimeout(300);
await sec.screenshot({ path: '/root/sparkler-lab/qa/shots/p4-mobile-s2shoot-stacked-full.png' });

// nav 44px tap targets
const nav = await mob.evaluate(() => {
  const a = document.querySelector('header#topnav nav a[href="#s2lab"]');
  const r = a.getBoundingClientRect();
  return { h: Math.round(r.height), minH: getComputedStyle(a).minHeight };
});
console.log('R9f nav 44px mobile:', JSON.stringify(nav), parseFloat(nav.minH) >= 44 ? 'PASS' : 'FAIL');

// mobile sample-load: toolbar AND canvas visible
await mob.evaluate(() => { localStorage.clear(); });
await mob.locator('.sample-open[data-sample="tunnel-drag"]').scrollIntoViewIfNeeded();
await mob.locator('.sample-open[data-sample="tunnel-drag"]').click();
await mob.waitForTimeout(2200);
const mobScroll = await mob.evaluate(() => {
  const tb = document.querySelector('#s4editor .editor-toolbar');
  const cv = document.getElementById('editorCanvas');
  const tr = tb.getBoundingClientRect(), cr = cv.getBoundingClientRect();
  return { vh: window.innerHeight, toolbarTop: Math.round(tr.top), toolbarBottom: Math.round(tr.bottom),
           canvasTop: Math.round(cr.top), canvasBottom: Math.round(cr.bottom),
           toolbarVis: tr.top >= 0 && tr.bottom <= window.innerHeight,
           canvasVisible: cr.top < window.innerHeight && cr.bottom > 0,
           toast: document.getElementById('labToast').textContent };
});
console.log('GATE-C mobile:', JSON.stringify(mobScroll));
await mob.screenshot({ path: '/root/sparkler-lab/qa/shots/p4-mobile-sample-load-scroll.png' });

// ---- desktop computed-style asserts for R9 batch ----
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
const styles = await page.evaluate(() => {
  const cs = (el) => el ? getComputedStyle(el) : null;
  const sampleBtn = document.querySelector('.sample-open');
  const scoreNum = document.getElementById('scoreNum');
  const scoreMain = document.querySelector('.score-main');
  const results = document.querySelector('#s2lab .lab-results');
  const heroLi = document.querySelector('#s1hero .s1-stats li');
  const fecTd = [...document.querySelectorAll('#s2shoot tbody td')].find(td => td.textContent.includes('exposure compensation'));
  return {
    sampleFont: sampleBtn ? cs(sampleBtn).fontFamily : null,
    scoreNumSize: scoreNum ? cs(scoreNum).fontSize : null,
    scoreMainSize: scoreMain ? cs(scoreMain).fontSize : null,
    tabular: scoreMain ? cs(scoreMain).fontVariantNumeric : null,
    ariaLive: results ? results.getAttribute('aria-live') : null,
    heroChip: heroLi ? heroLi.textContent.trim() : null,
    fecText: fecTd ? fecTd.textContent : null,
    hint: document.querySelector('#s4editor .editor-hint').textContent.trim(),
    toastRole: document.getElementById('labToast').getAttribute('role'),
    cardRole: document.querySelector('#s3heads .headCard').getAttribute('role'),
  };
});
console.log('R9 computed:', JSON.stringify(styles, null, 1));
const ok =
  /inherit|system/.test(styles.sampleFont) && !/Arial/i.test(styles.sampleFont) &&
  styles.scoreMainSize === '30px' && /tabular-nums/.test(styles.tabular) &&
  styles.ariaLive === 'polite' &&
  styles.heroChip.includes('procedural heads + PNG upload') &&
  styles.fecText.includes('flash exposure compensation') === false && styles.fecText.includes('exposure compensation (FEC)') &&
  styles.hint.includes('double-tap (or long-press) a head to remove') && styles.hint.includes('Esc to deselect') &&
  styles.toastRole === 'status' && styles.cardRole === 'button';
console.log('R9 batch all ok:', ok ? 'PASS' : 'FAIL');

// R2 scroll actually lands after smooth scroll completes
await page.locator('#s3heads .headCard').nth(3).scrollIntoViewIfNeeded();
await page.locator('#s3heads .headCard').nth(3).click();
await page.waitForTimeout(1600);
const landed = await page.evaluate(() => {
  const r = document.getElementById('s4editor').getBoundingClientRect();
  return { top: Math.round(r.top), landed: Math.abs(r.top) < 120,
           val: document.getElementById('headSelect').value,
           toast: document.getElementById('labToast').textContent };
});
console.log('R2 landed:', JSON.stringify(landed), landed.landed && landed.val === 'initials' && landed.toast.includes('HEAD selected') ? 'PASS' : 'FAIL');

console.log('MOB-ERRORS:', mobErrs.length, JSON.stringify(mobErrs.slice(0,5)));
await browser.close();
console.log('PHASE3-DONE');
