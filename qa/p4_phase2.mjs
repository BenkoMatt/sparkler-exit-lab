
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:8123/index.html';
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.setInputFiles('#fileInput', '/root/sparkler-lab/qa/synth_contact_v1.jpg');
await page.waitForTimeout(1500);

async function stageBox() {
  await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(300);
  return await page.locator('#editorCanvas').boundingBox();
}
const box = await stageBox();

await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.35);
await page.waitForTimeout(300);
const j2 = await page.evaluate(() => ({
  layers: window.__sparklerEditor.state().length,
  sel: window.__sparklerEditor.selected() != null,
}));
console.log('JOURNEY place head:', JSON.stringify(j2), j2.layers === 1 && j2.sel ? 'PASS' : 'FAIL');
await page.screenshot({ path: '/root/sparkler-lab/qa/shots/p4-editor-head-placed.png' });

await page.keyboard.press('Escape');
await page.waitForTimeout(150);
console.log('R5 esc-deselect:', await page.evaluate(() => window.__sparklerEditor.selected() === null) ? 'PASS' : 'FAIL');

await page.mouse.dblclick(box.x + box.width * 0.5, box.y + box.height * 0.35);
await page.waitForTimeout(300);
console.log('R5 dblclick-delete:', await page.evaluate(() => window.__sparklerEditor.state().length === 0) ? 'PASS' : 'FAIL');

await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
await page.waitForTimeout(300);
console.log('JOURNEY re-place:', await page.evaluate(() => window.__sparklerEditor.state().length));
await page.click('#undoBtn', { timeout: 3000 });
await page.waitForTimeout(200);
const afterUndo = await page.evaluate(() => window.__sparklerEditor.state().length);
console.log('JOURNEY undo:', afterUndo === 0 ? 'PASS (0 layers)' : 'FAIL ' + afterUndo);

const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
await page.click('#exportBtn');
const download = await downloadPromise;
const dlPath = '/root/sparkler-lab/qa/shots/p4-export-download.png';
await download.saveAs(dlPath);
const dlSize = fs.statSync(dlPath).size;
console.log('JOURNEY export:', download.suggestedFilename(), dlSize, 'bytes', dlSize > 10000 ? 'PASS' : 'FAIL');

// 4 gallery samples via a second page (robust selector handling)
const sampleResults = [];
for (const name of ['tunnel-drag', 'flash-blown', 'couple-walk', 'sparkler-heart']) {
  const btn = page.locator(`.sample-open[data-sample="${name}"]`);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => ({
    score: document.getElementById('scoreNum').textContent,
    canvasHidden: document.getElementById('editorCanvas').hidden,
    toolbarTop: Math.round(document.querySelector('#s4editor .editor-toolbar').getBoundingClientRect().top),
    vh: window.innerHeight,
    toast: document.getElementById('labToast').textContent,
  }));
  sampleResults.push({ name, ...r });
}
console.log('JOURNEY samples:', JSON.stringify(sampleResults));
const allSamplesOk = sampleResults.every(s => /^\d+$/.test(s.score) && !s.canvasHidden && s.toolbarTop >= 0 && s.toolbarTop < s.vh);
console.log('JOURNEY samples all ok (score + editor visible):', allSamplesOk ? 'PASS' : 'FAIL');

console.log('CONSOLE-ERRORS:', errors.length, JSON.stringify(errors.slice(0, 8)));
await browser.close();
console.log('PHASE2-DONE');
