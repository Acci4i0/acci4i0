// Snapshot new home (5 cards), /projects/, and each /studies/* page for visual QA.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'snapshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(browser, url, name, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: opts.darkMode ? 'dark' : 'light',
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  if (opts.scroll) await page.evaluate((y) => window.scrollTo(0, y), opts.scroll);
  if (opts.wheelTimes) {
    for (let i = 0; i < opts.wheelTimes; i++) {
      await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true })));
    }
    await page.waitForTimeout(700);
  }
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: opts.fullPage });
  console.log('wrote', p);
  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  const BASE = 'http://localhost:8001';

  // Home at each card position
  await shot(browser, `${BASE}/`, 'new-home-card-0', { wheelTimes: 0 });
  await shot(browser, `${BASE}/`, 'new-home-card-3-projects-index', { wheelTimes: 45 });
  await shot(browser, `${BASE}/`, 'new-home-card-4-contact', { wheelTimes: 60 });

  // /projects/
  await shot(browser, `${BASE}/projects/`, 'new-projects-light', { fullPage: true });
  await shot(browser, `${BASE}/projects/`, 'new-projects-dark', { fullPage: true, darkMode: true });

  // Studies
  await shot(browser, `${BASE}/studies/kimdot/`, 'new-studies-kimdot', { fullPage: true });
  await shot(browser, `${BASE}/studies/sa-m/`, 'new-studies-sa-m', { fullPage: true });
  await shot(browser, `${BASE}/studies/endless-horse/`, 'new-studies-horse', { fullPage: false });

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
