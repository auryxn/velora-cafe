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
  await page.waitForTimeout(1200);

  const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const y = Math.round((total * i) / steps);
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'instant' }), y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1000);

  const video = page.video();
  await context.close();
  await browser.close();
  const videoPath = await video.path();
  console.log(videoPath);
})();
