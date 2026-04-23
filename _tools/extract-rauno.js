// Extracts measurable values from https://rauno.me for the Acci4i0 rebuild study.
// Does NOT save source HTML/CSS/JS. Outputs rauno-values.json with numbers,
// colors, font declarations, and descriptive structural info only.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://rauno.me';
const OUT = path.join(__dirname, 'rauno-values.json');

const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 390, height: 844 },
];

async function extractAtViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Snapshot the DOM state once, then wait and snapshot again to detect autonomous animation.
  const snap1 = await page.evaluate(snapshotFn);
  await page.waitForTimeout(5000);
  const snap2 = await page.evaluate(snapshotFn);

  const movedElements = [];
  for (const [key, before] of Object.entries(snap1.watched)) {
    const after = snap2.watched[key];
    if (!after) continue;
    if (before.rect.x !== after.rect.x || before.rect.y !== after.rect.y
        || before.rect.width !== after.rect.width || before.rect.height !== after.rect.height) {
      movedElements.push({ key, before: before.rect, after: after.rect });
    }
  }

  const data = { ...snap1, autonomousMotion: movedElements };
  await context.close();
  return data;
}

// Runs inside the page. Must be a self-contained function (no closures).
function snapshotFn() {
  function cs(el) { return getComputedStyle(el); }
  function rect(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }
  function pickStyles(el, props) {
    const s = cs(el);
    const out = {};
    for (const p of props) out[p] = s.getPropertyValue(p);
    return out;
  }
  function describe(el, extraProps = []) {
    const props = [
      'display', 'position', 'overflow', 'overflow-x', 'overflow-y',
      'scroll-snap-type', 'scroll-snap-align',
      'width', 'height', 'padding', 'margin', 'gap',
      'background-color', 'color', 'border-radius', 'box-shadow',
      'font-family', 'font-size', 'font-weight', 'line-height', 'text-indent',
      'flex-direction', 'grid-auto-flow',
      'transition', 'transform', 'mix-blend-mode', 'opacity',
      ...extraProps,
    ];
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className && typeof el.className === 'string' ? el.className : null,
      rect: rect(el),
      styles: pickStyles(el, props),
    };
  }

  // --- Find the scroll container (carousel root). ---
  // Heuristic: element with overflow-x ∈ {auto, scroll} OR scroll-snap-type on x.
  const allEls = Array.from(document.querySelectorAll('body, body *'));
  const scrollers = allEls.filter(el => {
    const s = cs(el);
    const snap = s.getPropertyValue('scroll-snap-type');
    const ox = s.getPropertyValue('overflow-x');
    return (snap && snap !== 'none') || ox === 'auto' || ox === 'scroll';
  }).map(el => ({ el, info: describe(el) }));

  // The "main" scroller is the largest one by area.
  scrollers.sort((a, b) => (b.info.rect.width * b.info.rect.height) - (a.info.rect.width * a.info.rect.height));
  const mainScroller = scrollers[0] || null;

  // Direct children of the main scroller are candidate cards.
  let cardCandidates = [];
  if (mainScroller) {
    cardCandidates = Array.from(mainScroller.el.children).map(c => describe(c));
  }

  // --- @font-face rules from same-origin stylesheets. ---
  const fontFaces = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        fontFaces.push({
          cssText: rule.cssText,
          family: rule.style.getPropertyValue('font-family'),
          src: rule.style.getPropertyValue('src'),
          weight: rule.style.getPropertyValue('font-weight'),
          style: rule.style.getPropertyValue('font-style'),
        });
      }
    }
  }

  // --- @keyframes names declared. ---
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

  // --- Body / root backgrounds + typography. ---
  const body = document.body;
  const html = document.documentElement;

  const bodyDesc = describe(body);
  const htmlDesc = describe(html);

  // Large display text heuristic: elements with font-size >= 40px.
  const displayTexts = allEls
    .filter(el => {
      const fs = parseFloat(cs(el).getPropertyValue('font-size'));
      return fs >= 40 && el.textContent && el.textContent.trim().length > 0 && el.children.length === 0;
    })
    .slice(0, 20)
    .map(el => ({
      text: el.textContent.trim().slice(0, 60),
      styles: pickStyles(el, ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'text-indent']),
      rect: rect(el),
    }));

  // --- Yellow-ish elements (heuristic: rgb where r>180, g>150, b<120). ---
  function isYellowish(rgbStr) {
    const m = rgbStr.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const parts = m[1].split(',').map(s => parseFloat(s.trim()));
    const [r, g, b, a = 1] = parts;
    if (a === 0) return false;
    return r > 180 && g > 150 && b < 140 && r >= g;
  }
  const yellowish = allEls
    .filter(el => {
      const s = cs(el);
      const bg = s.getPropertyValue('background-color');
      return isYellowish(bg);
    })
    .slice(0, 30)
    .map(el => describe(el));

  // --- Circle candidates (border-radius 50% or equivalent, visible size). ---
  const circles = allEls
    .filter(el => {
      const s = cs(el);
      const br = s.getPropertyValue('border-radius');
      const r = el.getBoundingClientRect();
      const round = br.includes('50%') || (parseFloat(br) >= r.width / 2 && r.width > 0);
      return round && r.width >= 40 && r.height >= 40;
    })
    .slice(0, 20)
    .map(el => describe(el, ['background-color', 'mix-blend-mode', 'filter']));

  // --- Top progress indicator candidate: fixed/sticky element near the top
  // with many small children. ---
  const topBarCandidates = allEls
    .filter(el => {
      const s = cs(el);
      const pos = s.getPropertyValue('position');
      const r = el.getBoundingClientRect();
      return (pos === 'fixed' || pos === 'sticky') && r.top < 80 && r.width > 100;
    })
    .map(el => {
      const children = Array.from(el.children);
      return {
        ...describe(el),
        childCount: children.length,
        childSample: children.slice(0, 12).map(c => describe(c)),
      };
    });

  // Watched elements (for autonomous-motion diff between snapshots).
  const watched = {};
  (yellowish.slice(0, 5)).forEach((d, i) => { watched['yellow_' + i] = d; });
  (circles.slice(0, 5)).forEach((d, i) => { watched['circle_' + i] = d; });
  (topBarCandidates.slice(0, 3)).forEach((d, i) => { watched['topbar_' + i] = d; });

  return {
    url: location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollers: scrollers.slice(0, 5).map(s => s.info),
    mainScroller: mainScroller ? mainScroller.info : null,
    cardCandidates,
    cardCount: cardCandidates.length,
    body: bodyDesc,
    html: htmlDesc,
    fontFaces,
    keyframes,
    displayTexts,
    yellowish,
    circles,
    topBarCandidates,
    watched,
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

  // short printed summary
  const d = results.desktop;
  console.log('\n--- summary (desktop) ---');
  console.log('cardCount:', d.cardCount);
  console.log('mainScroller overflow-x:', d.mainScroller?.styles['overflow-x']);
  console.log('mainScroller scroll-snap-type:', d.mainScroller?.styles['scroll-snap-type']);
  console.log('body font-family:', d.body.styles['font-family']);
  console.log('@font-face count:', d.fontFaces.length);
  console.log('yellow-ish elements:', d.yellowish.length);
  console.log('circle candidates:', d.circles.length);
  console.log('top-bar candidates:', d.topBarCandidates.length);
  console.log('autonomously moving elements:', d.autonomousMotion.length);
}

main().catch(err => { console.error(err); process.exit(1); });
