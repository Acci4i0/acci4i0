// Reproduce at user's apparent window size (2419 × 1500) and capture what
// shows at the manifesto→projects transition. The user reported a "visible
// grey gap" that doesn't match my 1280-viewport diagnostic — investigating
// whether it's resolution-dependent.

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 2419, height: 1500 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const layout = await page.evaluate(() => {
    const body = document.body;
    const vp = document.querySelector('.viewport');
    const cards = Array.from(document.querySelectorAll('.frames > *'));
    const cs = (el) => getComputedStyle(el);
    return {
      bodyWidth: body.offsetWidth,
      bodyHeight: body.offsetHeight,
      bodyMinHeight: cs(body).minHeight,
      viewportRect: (() => { const r = vp.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      viewportOverflow: cs(vp).overflow,
      viewportWidth: cs(vp).width,
      cardCount: cards.length,
      cardWidth: cs(cards[0]).width,
      gap: cs(document.querySelector('.frames')).gap,
      framesScalerTransform: cs(document.querySelector('.frames-scaler')).transform,
    };
  });
  console.log('LAYOUT:', JSON.stringify(layout, null, 2));

  // Mid-transition between manifesto (idx 1) and projects-index (idx 2):
  // for N=4, MAX_SCROLL = 1218; idx 2 at scrollY=812; halfway at 609.
  for (const y of [609, 812, 1015]) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    // Trigger an extra wheel event so the preview-scale stays at 0.78
    await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true })));
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(__dirname, 'snapshots', `large-y${y}-active.png`) });
    // Settled state (no scroll → scale back to 1)
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(__dirname, 'snapshots', `large-y${y}-settled.png`) });
  }

  await browser.close();
})();
