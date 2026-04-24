// Verify that the home is now natively scrollable (body tall, overflow
// visible, scrollY advances on scroll). Snapshots the home at several
// scrollY positions to show the carousel advancing via real scroll.

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://localhost:8001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const dims = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    bodyHeight: document.body.offsetHeight,
    bodyMinHeight: getComputedStyle(document.body).minHeight,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    bodyOverflow: getComputedStyle(document.body).overflow,
    viewportHeight: window.innerHeight,
  }));
  console.log('dims:', JSON.stringify(dims, null, 2));

  // MAX_SCROLL for N=5 cards: 406 × 4 = 1624
  const positions = [0, 406, 812, 1218, 1624];
  for (const y of positions) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(500);
    const shot = path.join(__dirname, 'snapshots', `scroll-${y}.png`);
    await page.screenshot({ path: shot });
    const scrollY = await page.evaluate(() => window.scrollY);
    console.log(`scrollY=${scrollY} → ${shot}`);
  }
  await browser.close();
})();
