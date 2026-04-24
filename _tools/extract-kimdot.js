// Extracts measurable values from https://kimdot.de for the Acci4i0 rebuild study.
// Does NOT save source HTML/CSS/JS. Outputs kimdot-values.json with numbers,
// colors, font declarations, and descriptive structural info only.
//
// Focus points (per site-description-kimdot.md):
//   - .paper-top / .paper-bottom dimensions + border-bottom (dotted)
//   - .abriss strip geometry + writing-mode + rotation
//   - .abriss.falling transition (duration, easing) and transform
//   - parent perspective (for 3D hinge)
//   - <details>/<summary> toggle styling
//   - body/root backgrounds + typography

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://kimdot.de';
const OUT = path.join(__dirname, 'kimdot-values.json');

const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 390, height: 844 },
];

async function extractAtViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Snapshot the resting state first.
  const resting = await page.evaluate(snapshotFn);

  // Try to trigger the "falling" state on the first strip by adding the class,
  // then capture computed transform values while the animation is active.
  const falling = await page.evaluate(() => {
    const strip = document.querySelector('.abriss');
    if (!strip) return null;
    const before = getComputedStyle(strip);
    const beforeStyles = {
      transform: before.transform,
      transition: before.transition,
      transformOrigin: before.transformOrigin,
    };
    strip.classList.add('falling');
    // Force style recalc.
    void strip.offsetWidth;
    const after = getComputedStyle(strip);
    const afterStyles = {
      transform: after.transform,
      transition: after.transition,
      transformOrigin: after.transformOrigin,
    };
    return { beforeStyles, afterStyles };
  });

  await context.close();
  return { resting, falling };
}

function snapshotFn() {
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
      'background-color', 'color', 'border', 'border-top', 'border-right',
      'border-bottom', 'border-left', 'border-radius', 'box-shadow',
      'font-family', 'font-size', 'font-weight', 'line-height',
      'flex-direction', 'align-items', 'justify-content', 'flex',
      'writing-mode', 'text-orientation',
      'transition', 'transition-duration', 'transition-timing-function',
      'transform', 'transform-origin', 'perspective',
      'cursor', 'opacity', 'text-decoration',
      ...extra,
    ];
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: typeof el.className === 'string' ? el.className : null,
      rect: rect(el),
      styles: pick(el, props),
      innerTextSample: (el.innerText || '').trim().slice(0, 200),
    };
  }

  const body = document.body;
  const html = document.documentElement;

  const paper = document.querySelector('.paper');
  const paperTop = document.querySelector('.paper-top');
  const paperBottom = document.querySelector('.paper-bottom');
  const strips = Array.from(document.querySelectorAll('.abriss')).map(el => ({
    desc: describe(el),
    aInside: describe(el.querySelector('a')),
    textContainer: (() => {
      const inner = el.querySelector('span, div, p');
      return inner ? describe(inner) : null;
    })(),
  }));

  const detailsEl = document.querySelector('details');
  const summaryEl = document.querySelector('summary');

  // @font-face rules from same-origin stylesheets.
  const fontFaces = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        fontFaces.push({
          family: rule.style.getPropertyValue('font-family'),
          src: rule.style.getPropertyValue('src'),
          weight: rule.style.getPropertyValue('font-weight'),
          style: rule.style.getPropertyValue('font-style'),
          cssText: rule.cssText,
        });
      }
    }
  }

  // @keyframes names declared.
  const keyframes = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.KEYFRAMES_RULE) {
        keyframes.push({ name: rule.name, cssText: rule.cssText.slice(0, 400) });
      }
    }
  }

  // CSS rules mentioning .abriss or .falling — capture their computed text
  // so we can see transitions/transforms declared there (cssText is the
  // *declaration*, not page source).
  const abrissRules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.STYLE_RULE
          && (rule.selectorText || '').match(/\.abriss|\.falling|\.paper/)) {
        abrissRules.push({ selector: rule.selectorText, cssText: rule.cssText.slice(0, 400) });
      }
    }
  }

  return {
    url: location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    html: describe(html),
    body: describe(body),
    paper: describe(paper),
    paperTop: describe(paperTop),
    paperBottom: describe(paperBottom, ['perspective', 'transform-style']),
    strips,
    stripCount: strips.length,
    details: describe(detailsEl),
    summary: describe(summaryEl),
    fontFaces,
    keyframes,
    abrissRules,
  };
}

async function main() {
  const browser = await chromium.launch();
  const results = {};
  for (const vp of VIEWPORTS) {
    process.stdout.write(`extracting @ ${vp.label} (${vp.width}x${vp.height})… `);
    results[vp.label] = await extractAtViewport(browser, vp);
    console.log('done');
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`wrote ${OUT}`);

  const d = results.desktop.resting;
  console.log('\n--- summary (desktop) ---');
  console.log('strip count:', d.stripCount);
  console.log('paper-top border-bottom:', d.paperTop?.styles['border-bottom']);
  console.log('paper-bottom perspective:', d.paperBottom?.styles['perspective']);
  console.log('body font-family:', d.body.styles['font-family']);
  console.log('body background:', d.body.styles['background-color']);
  console.log('abriss transition (first strip):', d.strips[0]?.desc.styles.transition);
  console.log('abriss writing-mode:', d.strips[0]?.desc.styles['writing-mode']);
  if (results.desktop.falling) {
    console.log('abriss.falling transform:', results.desktop.falling.afterStyles.transform);
    console.log('abriss.falling transform-origin:', results.desktop.falling.afterStyles.transformOrigin);
  }
  console.log('@font-face count:', d.fontFaces.length);
  console.log('abriss-related CSS rules:', d.abrissRules.length);
}

main().catch(err => { console.error(err); process.exit(1); });
