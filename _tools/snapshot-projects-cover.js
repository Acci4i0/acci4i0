// Snapshot the new projects card cover at the centered scroll position
// (scrollY=812 when there are 4 cards) so we can compare 1:1 with rauno.

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Center on the projects card (idx 2 of 4 → scrollY = 812).
  await page.evaluate(() => window.scrollTo(0, 812));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(__dirname, 'snapshots', 'projects-cover-after.png') });

  // Mid-transition manifesto→projects (scrollY=609) to sanity-check gap.
  await page.evaluate(() => window.scrollTo(0, 609));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(__dirname, 'snapshots', 'projects-cover-mid-transition.png') });

  // Read computed styles for verification.
  await page.evaluate(() => window.scrollTo(0, 812));
  await page.waitForTimeout(800);
  const detail = await page.evaluate(() => {
    const card = document.querySelector('.card--projects-index');
    const label = document.querySelector('.projects-index__label');
    const body = document.querySelector('.projects-index__body');
    function pick(el) {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        background: s['background-color'],
        padding: s['padding'],
        borderRadius: s['border-radius'],
        fontSize: s['font-size'],
        fontWeight: s['font-weight'],
        color: s['color'],
        letterSpacing: s['letter-spacing'],
        position: s['position'],
        display: s['display'],
      };
    }
    return { card: pick(card), label: pick(label), body: pick(body) };
  });
  console.log(JSON.stringify(detail, null, 2));

  await browser.close();
})();
