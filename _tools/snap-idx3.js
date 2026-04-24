const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await c.newPage();
  await p.goto('http://localhost:8001/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  for (let i = 0; i < 30; i++) {
    await p.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })));
  }
  await p.waitForTimeout(900);
  await p.screenshot({ path: '/Users/ilarialando/Desktop/Acci4i0/_tools/snapshots/new-home-card-3.png' });
  await b.close();
  console.log('done');
})();
