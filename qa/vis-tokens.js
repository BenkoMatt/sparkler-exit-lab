// Visual analysis: screenshot crops -> numeric color/layout checks
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

  // computed style tokens on key elements
  const styles = await page.evaluate(() => {
    const pick = (sel, props) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const o = {};
      props.forEach((p) => (o[p] = cs[p]));
      return o;
    };
    const P = ['backgroundColor', 'color', 'borderRadius', 'borderColor', 'fontFamily', 'fontSize', 'fontWeight'];
    return {
      body: pick('body', P),
      section: pick('section', P),
      panelCard: pick('.panel, .card, figure, .headCard', P),
      h1: pick('h1', P),
      h2: pick('h2', P),
      h3: pick('h3', P),
      p: pick('p', P),
      btn: pick('button', P),
      btnAccent: pick('.sample-open', P),
      table: pick('table', P),
      tableCell: pick('td', P),
      headCard: pick('.headCard', P),
    };
  });
  rep.push('styles: ' + JSON.stringify(styles, null, 1).slice(0, 2600));

  // font sizes for hierarchy
  const sizes = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('h1, h2, h3, p, .headName, figcaption').forEach((el) => {
      const cs = getComputedStyle(el);
      const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
      out.push(tag + ': ' + cs.fontSize + ' / ' + cs.fontWeight + ' / ' + cs.color);
    });
    return [...new Set(out)].slice(0, 24);
  });
  rep.push('type scale:\n' + sizes.join('\n'));

  // accent color usage scan: which elements use gold vs blue
  const accentScan = await page.evaluate(() => {
    const counts = { gold: 0, blue: 0, other: 0 };
    const golds = [];
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el);
      const c = cs.color + ' ' + cs.backgroundColor + ' ' + cs.borderColor;
      if (c.includes('255, 179, 71')) { counts.gold++; if (golds.length < 18) golds.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')); }
      else if (c.includes('126, 200, 255')) counts.blue++;
    });
    return { counts, golds: [...new Set(golds)] };
  });
  rep.push('accent scan: ' + JSON.stringify(accentScan));

  // check editor stage / canvas border radius consistency
  const radii = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll('section, .panel, .card, figure, .headCard, button, table, img, canvas, input, select').forEach((el) => {
      const r = getComputedStyle(el).borderRadius;
      if (r && r !== '0px') set.add(r);
    });
    return [...set];
  });
  rep.push('border radii in use: ' + JSON.stringify(radii));

  // hero svg colors
  const heroSvg = await page.evaluate(() => {
    const svg = document.querySelector('#s1hero svg');
    if (!svg) return null;
    return { fills: [...svg.querySelectorAll('[fill]')].map((e) => e.getAttribute('fill')).slice(0, 10) };
  });
  rep.push('hero svg fills: ' + JSON.stringify(heroSvg && heroSvg.fills));

  // contrast: compute on key text/bg pairs
  function lum(hex) {
    const c = hex.replace('#', '');
    const f = (i) => {
      let v = parseInt(c.substr(i * 2, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(0) + 0.7152 * f(1) + 0.0722 * f(2);
  }
  function cr(a, b) { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
  const tokens = { bg: '#0b0d12', panel: '#141824', text: '#e8e6df', muted: '#9aa0ae', gold: '#ffb347', blue: '#7ec8ff', good: '#7ddf8e', bad: '#ff6b6b' };
  const crs = {
    'text/bg': cr(tokens.text, tokens.bg).toFixed(2),
    'text/panel': cr(tokens.text, tokens.panel).toFixed(2),
    'muted/bg': cr(tokens.muted, tokens.bg).toFixed(2),
    'muted/panel': cr(tokens.muted, tokens.panel).toFixed(2),
    'gold/panel': cr(tokens.gold, tokens.panel).toFixed(2),
    'blue/panel': cr(tokens.blue, tokens.panel).toFixed(2),
    'good/panel': cr(tokens.good, tokens.panel).toFixed(2),
    'bad/panel': cr(tokens.bad, tokens.panel).toFixed(2),
  };
  rep.push('contrast ratios: ' + JSON.stringify(crs));

  // mobile: s2shoot table check at 390
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto('about:blank');
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(500);
  const tableInfo = await p2.evaluate(() => {
    const t = document.querySelector('#s2shoot table');
    if (!t) return null;
    const cs = getComputedStyle(t);
    const wrap = t.parentElement;
    return {
      tableW: Math.round(t.getBoundingClientRect().width),
      display: cs.display,
      overflowX: cs.overflowX,
      parentOverflowX: wrap ? getComputedStyle(wrap).overflowX : null,
      parentClass: wrap ? wrap.className : null,
      scrollW: t.scrollWidth, clientW: t.clientWidth,
    };
  });
  rep.push('mobile s2shoot table: ' + JSON.stringify(tableInfo));
  const svgInfo = await p2.evaluate(() => {
    const svg = document.querySelector('#s2shoot svg');
    const r = svg.getBoundingClientRect();
    const wrap = svg.parentElement;
    return { w: Math.round(r.width), h: Math.round(r.height), wrapOverflowX: getComputedStyle(wrap).overflowX, viewBox: svg.getAttribute('viewBox') };
  });
  rep.push('mobile diagram svg: ' + JSON.stringify(svgInfo));
  const svgDesk = await page.evaluate(() => {
    const svg = document.querySelector('#s2shoot svg');
    const r = svg.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  rep.push('desk diagram svg: ' + JSON.stringify(svgDesk));

  await ctx2.close();
  await ctx.close();
  await browser.close();
  fs.writeFileSync('/root/sparkler-lab/qa/vis-tokens.log', rep.join('\n'));
  console.log(rep.join('\n'));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });