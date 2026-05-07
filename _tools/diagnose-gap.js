// Diagnose the gap between manifesto and projects cards.

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const layout = await page.evaluate(() => {
    const frames = document.querySelector('.frames');
    const cards = Array.from(document.querySelectorAll('.frames > *'));
    const cs = getComputedStyle(frames);
    return {
      framesGap: cs.gap,
      framesDisplay: cs.display,
      bodyMinHeight: getComputedStyle(document.body).minHeight,
      cardCount: cards.length,
      cards: cards.map(c => {
        const r = c.getBoundingClientRect();
        const s = getComputedStyle(c);
        return {
          tag: c.tagName.toLowerCase(),
          classes: typeof c.className === 'string' ? c.className : null,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          width: s.width,
          marginLeft: s.marginLeft,
          marginRight: s.marginRight,
          paddingLeft: s.paddingLeft,
          paddingRight: s.paddingRight,
          flex: s.flex,
          flexShrink: s.flexShrink,
          display: s.display,
        };
      }),
    };
  });
  console.log(JSON.stringify(layout, null, 2));

  // Snapshot at the gap between manifesto (card 1) and projects-index (card 2).
  // For 4 cards, MAX_SCROLL = 1218. card 1 center at scrollY=406, card 2 at 812.
  // Halfway between = 609.
  await page.evaluate(() => window.scrollTo(0, 609));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'snapshots', 'diag-gap-manifesto-to-projects.png') });

  // Compare: gap between bio (card 0) and manifesto (card 1), at scrollY=203.
  await page.evaluate(() => window.scrollTo(0, 203));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'snapshots', 'diag-gap-bio-to-manifesto.png') });

  // Gap between projects-index (card 2) and contact (card 3), at scrollY=1015.
  await page.evaluate(() => window.scrollTo(0, 1015));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'snapshots', 'diag-gap-projects-to-contact.png') });

  await browser.close();
})();
