// Check EXIF card populated after sample load + gallery captions + lab photo preview
const { chromium } = require('/root/node_modules/playwright');
const URL = 'http://127.0.0.1:8123/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('about:blank');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.querySelectorAll('.sample-open').forEach((b) => {
      if (b.getAttribute('data-sample') === 'tunnel-drag') b.click();
    });
  });
  await page.waitForTimeout(2000);
  const res = await page.evaluate(() => {
    const exifCard = document.getElementById('exifCard');
    const labPhoto = document.querySelector('#s2lab img, #s2lab canvas.photo');
    return {
      exifHTML: exifCard ? exifCard.textContent.replace(/\s+/g, ' ').slice(0, 300) : null,
      labPhoto: labPhoto ? { tag: labPhoto.tagName, w: Math.round(labPhoto.getBoundingClientRect().width), h: Math.round(labPhoto.getBoundingClientRect().height), nw: labPhoto.naturalWidth || labPhoto.width } : null,
      scoreNum: document.getElementById('scoreNum') && document.getElementById('scoreNum').textContent,
    };
  });
  console.log(JSON.stringify(res, null, 1));

  // gallery captions
  const gal = await page.evaluate(() => {
    const figs = [...document.querySelectorAll('#s5gallery figure')];
    return figs.map((f) => {
      const img = f.querySelector('img');
      const cap = f.querySelector('figcaption');
      const ir = img.getBoundingClientRect();
      const cr = cap.getBoundingClientRect();
      return {
        src: img.src.split('/').pop(),
        natural: img.naturalWidth + 'x' + img.naturalHeight,
        disp: Math.round(ir.width) + 'x' + Math.round(ir.height),
        arNatural: (img.naturalWidth / img.naturalHeight).toFixed(3),
        arDisp: (ir.width / ir.height).toFixed(3),
        cap: cap.textContent.replace(/\s+/g, ' ').slice(0, 120),
      };
    });
  });
  console.log(JSON.stringify(gal, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });