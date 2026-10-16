const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const outDir = path.resolve(__dirname, 'videos');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width: 1440, height: 1200 } },
  });
  const page = await context.newPage();
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const duration = 26000;
    const start = performance.now();
    const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    while (performance.now() - start < duration) {
      const progress = Math.min((performance.now() - start) / duration, 1);
      window.scrollTo(0, Math.round(max * easeInOutCubic(progress)));
      await sleep(16);
    }
    window.scrollTo(0, max);
  });

  await page.waitForTimeout(1800);
  const video = page.video();
  await context.close();
  await browser.close();
  console.log(await video.path());
})();
