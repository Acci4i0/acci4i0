// Visual QA for the rauno.me-faithful home rebuild.
// Serves the repo root on :8002, screenshots load state, each card,
// mid-scroll preview state and the crosshair debug mode.

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'snapshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

async function main() {
  await new Promise((r) => server.listen(8002, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:8002/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, 'og-00-load-early.png') });
  await page.waitForTimeout(1600); // intro animations done
  await page.screenshot({ path: path.join(OUT, 'og-01-bio.png') });

  // Mid-scroll: capture preview scale + yellow tracker.
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, 'og-02-midscroll.png') });

  // Each card position (406px per transition).
  const names = ['bio', 'dd', 'craft', 'history', 'projects', 'notes', 'contact', 'manifesto'];
  for (let i = 1; i < names.length; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * 406);
    await page.waitForTimeout(900); // settle back to scale 1
    await page.screenshot({ path: path.join(OUT, `og-1${i}-${names[i]}.png`) });
  }

  // Email copy state.
  await page.evaluate(() => window.scrollTo(0, 6 * 406));
  await page.waitForTimeout(600);
  // Click off-center: the crosshair owns the exact viewport center (as OG).
  await page.click('.email-button', { position: { x: 10, y: 10 } });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, 'og-06-email-copied.png') });

  // Debug wireframe mode on the bio card.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
  await page.click('.cross');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'og-07-debug.png') });
  await page.click('.cross'); // debug off again

  // Mobile-ish viewport for fit-scale sanity.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'og-08-mobile.png') });

  await browser.close();
  server.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
