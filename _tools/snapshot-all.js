// Capture full-page screenshots + complete content dumps from the 3 originals,
// so the rebuild can match them 1:1. Outputs snapshots/ PNG files and updated
// *-values.json with no arbitrary limits on captured elements.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'snapshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  { name: 'kimdot',         url: 'https://kimdot.de' },
  { name: 'sa-m',           url: 'https://sa-m.fr' },
  { name: 'endless-horse',  url: 'https://endless.horse' },
];

async function snapshot(browser, t) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const shotPath = path.join(OUT_DIR, `${t.name}-desktop.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('   screenshot:', shotPath);

  // Dump body innerText verbatim (no clipping) so we have the literal content
  // of the page for a 1:1 rebuild. ASCII / crossword text lives here.
  const content = await page.evaluate(() => {
    function cs(el) { return getComputedStyle(el); }
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    }
    function pickAll(el) {
      const s = cs(el);
      const out = {};
      for (let i = 0; i < s.length; i++) {
        const p = s[i];
        const v = s.getPropertyValue(p);
        if (v && v !== '0px' && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== 'rgba(0, 0, 0, 0)' && v !== '') {
          out[p] = v;
        }
      }
      return out;
    }

    // Collect all text nodes with their rects + computed styles.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const txt = n.nodeValue;
      if (!txt || !txt.trim()) continue;
      const parent = n.parentElement;
      if (!parent) continue;
      const r = parent.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      textNodes.push({
        text: txt,
        parentTag: parent.tagName.toLowerCase(),
        parentClasses: typeof parent.className === 'string' ? parent.className : null,
        rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        font: cs(parent).getPropertyValue('font-size') + ' ' + cs(parent).getPropertyValue('font-weight') + ' ' + cs(parent).getPropertyValue('font-family'),
      });
    }

    // Verbatim <pre> content (for endless.horse ASCII).
    const pres = Array.from(document.querySelectorAll('pre')).map(el => ({
      text: el.textContent,
      rect: rect(el),
      style: pickAll(el),
    }));

    // Links in order with computed styles.
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent,
      href: a.getAttribute('href'),
      rect: rect(a),
      style: pickAll(a),
    }));

    // Body + html + documentScrollHeight for reference.
    return {
      url: location.href,
      title: document.title,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      htmlStyle: pickAll(document.documentElement),
      bodyStyle: pickAll(document.body),
      bodyInnerText: document.body.innerText,
      textNodes,
      pres,
      links,
    };
  });

  fs.writeFileSync(path.join(__dirname, `${t.name}-full.json`), JSON.stringify(content, null, 2));

  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  for (const t of TARGETS) {
    console.log('\n=== ', t.name, '===');
    try { await snapshot(browser, t); }
    catch (e) { console.error('  FAIL:', e.message); }
  }
  await browser.close();
  console.log('\ndone');
}

main().catch(err => { console.error(err); process.exit(1); });
