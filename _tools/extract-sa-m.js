// Extracts measurable values from https://sa-m.fr for the Acci4i0 rebuild study.
// Generic structural + typographic extractor — no source HTML/CSS/JS is copied.
// Outputs sa-m-values.json.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://sa-m.fr';
const OUT = path.join(__dirname, 'sa-m-values.json');

const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile', width: 390, height: 844 },
];

async function extractAtViewport(browser, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const snap1 = await page.evaluate(snapshotFn);
  await page.waitForTimeout(4000);
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

  const result = { ...snap1, autonomousMotion: movedElements };
  await context.close();
  return result;
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
      'display', 'position', 'overflow', 'overflow-x', 'overflow-y',
      'width', 'height', 'padding', 'margin', 'gap',
      'background-color', 'background-image', 'color',
      'border-radius', 'box-shadow', 'border',
      'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
      'text-transform', 'text-align',
      'flex-direction', 'align-items', 'justify-content',
      'transition', 'transform', 'transform-origin',
      'mix-blend-mode', 'opacity', 'z-index',
      ...extra,
    ];
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: typeof el.className === 'string' ? el.className : null,
      rect: rect(el),
      styles: pick(el, props),
      innerTextSample: (el.innerText || '').trim().slice(0, 200),
      childCount: el.children.length,
    };
  }

  const allEls = Array.from(document.querySelectorAll('body, body *'));

  // Find the largest visible element (likely the main container).
  const visible = allEls.filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && cs(el).visibility !== 'hidden';
  });

  // Top-level structural children of body.
  const bodyChildren = Array.from(document.body.children).map(el => describe(el));

  // All display text ≥ 24px (candidate headings / display faces).
  const displayTexts = allEls
    .filter(el => {
      const fs = parseFloat(cs(el).getPropertyValue('font-size'));
      return fs >= 24 && el.textContent && el.textContent.trim().length > 0 && el.children.length === 0;
    })
    .slice(0, 30)
    .map(el => ({
      text: el.textContent.trim().slice(0, 100),
      styles: pick(el, ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'text-transform', 'letter-spacing']),
      rect: rect(el),
    }));

  // Elements with animations or transitions declared.
  const animated = allEls
    .filter(el => {
      const s = cs(el);
      const trans = s.getPropertyValue('transition-duration');
      const anim = s.getPropertyValue('animation-duration');
      return (trans && trans !== '0s' && trans !== 'none') || (anim && anim !== '0s' && anim !== 'none');
    })
    .slice(0, 20)
    .map(el => describe(el, ['transition-duration', 'transition-property', 'transition-timing-function', 'animation-name', 'animation-duration', 'animation-timing-function']));

  // Interactive elements: anchors, buttons.
  const links = Array.from(document.querySelectorAll('a')).slice(0, 40).map(a => ({
    text: a.textContent.trim().slice(0, 100),
    href: a.getAttribute('href'),
    styles: pick(a, ['color', 'font-family', 'font-size', 'font-weight', 'text-decoration', 'display', 'padding']),
    rect: rect(a),
  }));

  // Images / SVGs (count + sizes — no URLs beyond domain).
  const images = Array.from(document.querySelectorAll('img')).map(img => ({
    alt: img.alt,
    host: (() => { try { return new URL(img.currentSrc || img.src, location.href).host; } catch { return null; } })(),
    rect: rect(img),
    natural: { w: img.naturalWidth, h: img.naturalHeight },
  })).slice(0, 20);
  const svgs = Array.from(document.querySelectorAll('svg')).map(s => ({
    rect: rect(s),
    childTags: Array.from(s.children).map(c => c.tagName.toLowerCase()).slice(0, 10),
  })).slice(0, 20);

  // Body / html / root containers.
  const body = document.body;
  const html = document.documentElement;

  // @font-face rules.
  const fontFaces = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        fontFaces.push({
          family: rule.style.getPropertyValue('font-family'),
          src: rule.style.getPropertyValue('src').slice(0, 200),
          weight: rule.style.getPropertyValue('font-weight'),
          style: rule.style.getPropertyValue('font-style'),
        });
      }
    }
  }

  // @keyframes names.
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

  // Watched set for autonomous-motion diff.
  const watched = {};
  displayTexts.slice(0, 5).forEach((d, i) => { watched['text_' + i] = d; });
  animated.slice(0, 5).forEach((d, i) => { watched['anim_' + i] = d; });

  return {
    url: location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    html: describe(html),
    body: describe(body),
    bodyChildren,
    bodyChildCount: document.body.children.length,
    displayTexts,
    animated,
    links,
    images,
    imageCount: document.querySelectorAll('img').length,
    svgs,
    svgCount: document.querySelectorAll('svg').length,
    fontFaces,
    keyframes,
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

  const d = results.desktop;
  console.log('\n--- summary (desktop) ---');
  console.log('title:', d.title);
  console.log('body font:', d.body.styles['font-family']);
  console.log('body bg:', d.body.styles['background-color']);
  console.log('body children:', d.bodyChildCount);
  console.log('display texts:', d.displayTexts.length);
  console.log('animated elements:', d.animated.length);
  console.log('links:', d.links.length);
  console.log('images:', d.imageCount, '/ svgs:', d.svgCount);
  console.log('@font-face:', d.fontFaces.length, '/ @keyframes:', d.keyframes.length);
  console.log('autonomously moving:', d.autonomousMotion.length);
}

main().catch(err => { console.error(err); process.exit(1); });
