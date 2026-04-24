// Snapshot each study card of the local home (port 8001) for visual QA.
// Uses Playwright to drive the carousel by dispatching wheel events, then
// takes a screenshot once the card is centered.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'snapshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const HOME = 'http://localhost:8001/';

// Index of each card in .frames children (matches index.html order).
const CARDS = [
  { name: 'rebuild-bio',     index: 0 },
  { name: 'rebuild-kimdot',  index: 3 },
  { name: 'rebuild-sam',     index: 4 },
  { name: 'rebuild-horse',   index: 5 },
  { name: 'rebuild-contact', index: 6 },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(HOME, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  for (const c of CARDS) {
    // Snap to card index by dispatching wheel events to accumulate virtualScroll.
    // MAX_SCROLL = 406 * (N-1); progress = idx/(N-1); virtualScroll = idx * 406.
    const target = c.index;
    await page.evaluate((idx) => {
      // Simulate enough wheel deltas to land on the target card.
      // Rapid bursts until active tick matches idx, capped at 200 iterations.
      const needed = idx * 406;
      for (let i = 0; i < needed; i += 40) {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));
      }
    }, target);
    await page.waitForTimeout(900);
    const shot = path.join(OUT, `${c.name}.png`);
    await page.screenshot({ path: shot });
    console.log('wrote', shot);
    // Reset for next card.
    await page.evaluate(() => {
      for (let i = 0; i < 400; i++) {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, bubbles: true, cancelable: true }));
      }
    });
    await page.waitForTimeout(500);
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
