// QA journey: load -> 4 samples -> place heads -> export; collect ALL console messages
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:8123/index.html';
const consoleMsgs = [];
const pageErrors = [];
const reqFailed = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.location().url ? m.location().url.split('/').pop() + ':' + m.location().lineNumber : ''} ${m.text()}`));
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('requestfailed', (r) => reqFailed.push(r.url() + ' :: ' + (r.failure() || {}).errorText));

// ---- step 1: load
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// ---- step 2: 4 gallery samples through the editor path (sample-open buttons)
for (const name of ['tunnel-drag', 'flash-blown', 'couple-walk', 'sparkler-heart']) {
  await page.click(`button.sample-open[data-sample="${name}"]`);
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => ({
    hasLab: !!(window.__sparklerLab && window.__sparklerLab.imageDataUrl),
    editorBase: window.__sparklerEditor ? window.__sparklerEditor.baseSize() : null,
    analysis: window.__sparklerLab ? (window.__sparklerLab.analysis ? window.__sparklerLab.analysis.total : 'none') : 'n/a',
  }));
  console.log(`sample ${name}: lab=${st.hasLab} editorBase=${JSON.stringify(st.editorBase)} score=${st.analysis}`);
}

// ---- step 3: lab path — file via fileInput (use a real sample file through CDP-free upload)
const fs = await import('fs');
const file = '/root/sparkler-lab/site/assets/img/sample-tunnel-drag.jpg';
const buf = fs.readFileSync(file);
await page.setInputFiles('#fileInput', { name: 'my photo.jpg', mimeType: 'image/jpeg', buffer: buf });
await page.waitForTimeout(1200);
const labState = await page.evaluate(() => ({
  exif: window.__sparklerLab && window.__sparklerLab.exif ? window.__sparklerLab.exif : null,
  score: window.__sparklerLab && window.__sparklerLab.analysis ? window.__sparklerLab.analysis.total : null,
}));
console.log('fileInput path: score=' + labState.score + ' exif=' + JSON.stringify(labState.exif).slice(0, 120));

// ---- step 4: place heads on the editor canvas
await page.click('#editorCanvas'); // places head (classic selected)
await page.waitForTimeout(400);
// drag to move
const box = await page.locator('#editorCanvas').boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(400);
// place 2 more heads at other spots
for (const fx of [0.3, 0.75]) {
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * 0.3);
  await page.waitForTimeout(300);
}
const layerCount = await page.evaluate(() => window.__sparklerEditor.state().length);
console.log('layers placed: ' + layerCount);

// ---- step 5: export
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.click('#exportBtn');
const download = await dl;
console.log('export download: ' + (download ? download.suggestedFilename() : 'NO DOWNLOAD EVENT'));

// ---- step 6: keyboard operability of toolbar
await page.focus('#headSelect');
const kb = [];
for (const [sel, key] of [['#headSelect', 'ArrowDown'], ['#glowRange', 'ArrowLeft'], ['#opacityRange', 'ArrowRight']]) {
  await page.focus(sel);
  const before = await page.evaluate((s) => document.querySelector(s).value, sel);
  await page.keyboard.press(key);
  const after = await page.evaluate((s) => document.querySelector(s).value, sel);
  kb.push(`${sel}: ${before}->${after}`);
}
console.log('keyboard: ' + kb.join(' | '));
// undo/redo via keyboard
await page.click('#editorCanvas');
await page.keyboard.press('Control+z');
const afterUndo = await page.evaluate(() => window.__sparklerEditor.state().length);
console.log('after ctrl+z layers: ' + afterUndo);

// ---- step 7: memory probes — flicker rAF behavior
const rafState = await page.evaluate(async () => {
  // count rAF activity over 500ms with heads present (flicker on) vs after clearing layers
  let frames = 0;
  const cb = () => { frames++; requestAnimationFrame(cb); };
  requestAnimationFrame(cb);
  await new Promise((r) => setTimeout(r, 500));
  const active = frames; // ~30
  // now stop flicker via control
  const layers = window.__sparklerEditor.state();
  return { framesObserved: active, layers: layers.length };
});
console.log('rAF probe: ' + JSON.stringify(rafState));

// ---- step 8: localStorage schema
const ls = await page.evaluate(() => {
  const raw = localStorage.getItem('sparklerLabEditor');
  return raw ? JSON.stringify(Object.keys(JSON.parse(raw))) : 'EMPTY';
});
console.log('localStorage keys: ' + ls);

// ---- step 9: re-import idempotency (module re-import safety): dispatch image-loaded twice more
await page.evaluate(() => {
  document.dispatchEvent(new CustomEvent('sparklerlab:image-loaded'));
  window.dispatchEvent(new CustomEvent('sparklerlab:image-loaded'));
});
await page.waitForTimeout(600);
const post = await page.evaluate(() => window.__sparklerEditor.state().length);
console.log('layers after double re-dispatch (should be unchanged): ' + post);

await page.screenshot({ path: '/root/sparkler-lab/qa/p3-journey.png', fullPage: false });

// ---- report
console.log('\n=== CONSOLE MESSAGES (' + consoleMsgs.length + ') ===');
for (const m of consoleMsgs) console.log(m);
console.log('\n=== PAGE ERRORS (' + pageErrors.length + ') ===');
for (const e of pageErrors) console.log(e);
console.log('\n=== FAILED REQUESTS (' + reqFailed.length + ') ===');
for (const e of reqFailed) console.log(e);

await browser.close();
const bad = consoleMsgs.filter((m) => m.startsWith('[error]')).length + pageErrors.length;
process.exit(bad ? 1 : 0);