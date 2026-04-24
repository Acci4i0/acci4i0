// Extracts measurable values from https://endless.horse for the Acci4i0 rebuild study.
// Outputs endless-horse-values.json — no source HTML/CSS/JS is copied.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://endless.horse';
const OUT = path.join(__dirname, 'endless-horse-values.json');

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // First snapshot at rest.
  const snap = await page.evaluate(() => {
    function cs(el) { return getComputedStyle(el); }
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    }
    function pick(el, props) {
      const s = cs(el);
      const out = {};
      for (const p of props) out[p] = s.getPropertyValue(p);
      return out;
    }
    function describe(el, extra = []) {
      if (!el) return null;
      const props = [
        'display', 'position', 'overflow',
        'width', 'height', 'padding', 'margin', 'gap',
        'background-color', 'background-image', 'color',
        'font-family', 'font-size', 'font-weight', 'line-height',
        'white-space', 'letter-spacing', 'text-align',
        'transition', 'transform', 'animation-name', 'animation-duration',
        ...extra,
      ];
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: typeof el.className === 'string' ? el.className : null,
        rect: rect(el),
        styles: pick(el, props),
        innerTextSample: (el.innerText || '').slice(0, 600),
        childTags: Array.from(el.children).map(c => c.tagName.toLowerCase()).slice(0, 20),
        childCount: el.children.length,
      };
    }

    const body = document.body;
    const html = document.documentElement;

    const bodyChildren = Array.from(document.body.children).map(el => describe(el));

    // Pre elements (ASCII art is typically in <pre>).
    const pres = Array.from(document.querySelectorAll('pre')).map(el => ({
      desc: describe(el),
      fullText: el.textContent,
      charCount: el.textContent.length,
      lineCount: el.textContent.split('\n').length,
    }));

    // Find the largest text block — likely the horse ASCII body.
    const allEls = Array.from(document.querySelectorAll('body *'));
    const longTextEls = allEls
      .filter(el => {
        const t = el.textContent || '';
        return t.length > 200 && el.children.length <= 2;
      })
      .slice(0, 5)
      .map(el => ({ desc: describe(el), textLength: el.textContent.length }));

    // Links.
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent.trim().slice(0, 120),
      href: a.getAttribute('href'),
      styles: pick(a, ['color', 'font-family', 'font-size', 'text-decoration']),
    }));

    // Scripts — just count, don't capture source.
    const scriptCount = document.querySelectorAll('script').length;

    return {
      url: location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentScrollHeight: document.documentElement.scrollHeight,
      html: describe(html),
      body: describe(body),
      bodyChildren,
      pres,
      preCount: document.querySelectorAll('pre').length,
      longTextEls,
      links,
      scriptCount,
    };
  });

  // Also scroll down to see if leg repetition is driven by JS (height grows?).
  const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  const afterScrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  await browser.close();
  const result = {
    desktop: { ...snap, growsOnScroll: afterScrollHeight > initialHeight, initialHeight, afterScrollHeight },
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('wrote', OUT);

  const d = result.desktop;
  console.log('\n--- summary ---');
  console.log('title:', d.title);
  console.log('body font:', d.body.styles['font-family']);
  console.log('body bg:', d.body.styles['background-color']);
  console.log('body color:', d.body.styles['color']);
  console.log('body children:', d.bodyChildren.length, 'tags:', d.bodyChildren.map(c => c.tag));
  console.log('<pre> count:', d.preCount);
  d.pres.forEach((p, i) => {
    console.log(`  pre[${i}] lines=${p.lineCount} chars=${p.charCount} rect=${JSON.stringify(p.desc.rect)}`);
    console.log('  styles:', p.desc.styles['font-family'], p.desc.styles['font-size'], p.desc.styles['line-height']);
    console.log('  first 200 chars:', JSON.stringify(p.fullText.slice(0, 200)));
  });
  console.log('links:', d.links.length, d.links.map(l => `${l.text}→${l.href}`));
  console.log('scripts:', d.scriptCount);
  console.log('initial height:', d.initialHeight, 'after scroll:', d.afterScrollHeight, 'grows:', d.growsOnScroll);
}

main().catch(err => { console.error(err); process.exit(1); });
