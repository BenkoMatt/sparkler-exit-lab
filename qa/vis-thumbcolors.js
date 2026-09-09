
const { chromium } = require('/root/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext()).newPage();
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const data = await page.evaluate(() => {
    return [...document.querySelectorAll('#s3heads canvas.thumb')].map((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let r = 0, g = 0, bl = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] + d[i+1] + d[i+2] > 60) { r += d[i]; g += d[i+1]; bl += d[i+2]; n++; }
      }
      return n ? { litPx: n, avg: [Math.round(r/n), Math.round(g/n), Math.round(bl/n)] } : { litPx: 0 };
    });
  });
  console.log(JSON.stringify(data));
  await b.close();
})();
