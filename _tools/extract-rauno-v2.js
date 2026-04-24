// v2 rauno.me extraction — focused on:
//   1) scroll/snap/wheel mechanics on the home carousel
//   2) the /projects list page (typography, layout, hover states)
//
// Output: rauno-values-v2.json
// Also dumps screenshots of hover states to snapshots/.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_JSON = path.join(__dirname, 'rauno-values-v2.json');
const SHOT_DIR = path.join(__dirname, 'snapshots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function captureHome(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('https://rauno.me', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const scroll = await page.evaluate(() => {
    function cs(el) { return getComputedStyle(el); }
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    }

    // Walk up from the body looking for scrollable/snap containers.
    const all = Array.from(document.querySelectorAll('body, body *'));
    const snapCandidates = all.filter(el => {
      const s = cs(el);
      return s.scrollSnapType && s.scrollSnapType !== 'none';
    }).map(el => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: typeof el.className === 'string' ? el.className : null,
      rect: rect(el),
      scrollSnapType: cs(el).scrollSnapType,
      scrollBehavior: cs(el).scrollBehavior,
      overflow: cs(el).overflow,
      overflowX: cs(el).overflowX,
      overflowY: cs(el).overflowY,
      overscrollBehavior: cs(el).overscrollBehavior,
      overscrollBehaviorX: cs(el).overscrollBehaviorX,
      overscrollBehaviorY: cs(el).overscrollBehaviorY,
      willChange: cs(el).willChange,
      transform: cs(el).transform,
      width: cs(el).width,
      height: cs(el).height,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      childSnapAlign: Array.from(el.children).slice(0, 15).map(c => ({
        tag: c.tagName.toLowerCase(),
        classes: typeof c.className === 'string' ? c.className : null,
        scrollSnapAlign: cs(c).scrollSnapAlign,
        scrollSnapStop: cs(c).scrollSnapStop,
        scrollMargin: cs(c).scrollMargin,
        width: cs(c).width,
        flexBasis: cs(c).flexBasis,
        rect: rect(c),
      })),
    }));

    // Scrollable elements (overflow auto/scroll) — for the JS-driven case.
    const scrollables = all.filter(el => {
      const s = cs(el);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll'
           || s.overflowY === 'auto' || s.overflowY === 'scroll');
    }).slice(0, 12).map(el => ({
      tag: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className : null,
      rect: rect(el),
      overflow: cs(el).overflow,
      overflowX: cs(el).overflowX,
      overflowY: cs(el).overflowY,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    }));

    return {
      htmlScrollBehavior: cs(document.documentElement).scrollBehavior,
      bodyScrollBehavior: cs(document.body).scrollBehavior,
      htmlOverflow: cs(document.documentElement).overflow,
      bodyOverflow: cs(document.body).overflow,
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      snapCandidates,
      snapCandidateCount: snapCandidates.length,
      scrollables,
    };
  });

  // Probe wheel behavior empirically: dispatch a wheel event, check if body
  // scroll advanced, check if document scrollTop changed, compare to the
  // native scroll behavior.
  const wheelProbe = await page.evaluate(async () => {
    const beforeY = window.scrollY;
    const beforeX = window.scrollX;
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 200));
    const afterY = window.scrollY;
    const afterX = window.scrollX;
    return { beforeY, beforeX, afterY, afterX };
  });

  // Dispatch a series of wheel events and see if scrollY advances smoothly or
  // snaps to discrete positions (indicates snap mandatory).
  const wheelBurst = await page.evaluate(async () => {
    const positions = [];
    for (let i = 0; i < 12; i++) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 60));
      positions.push({ y: window.scrollY, x: window.scrollX });
    }
    await new Promise(r => setTimeout(r, 800)); // let snap settle
    positions.push({ y: window.scrollY, x: window.scrollX, settled: true });
    window.scrollTo(0, 0);
    return positions;
  });

  // Check for registered wheel/scroll listeners on known targets.
  const listenerInfo = await page.evaluate(() => {
    // Playwright doesn't give us addEventListener lists directly, but we can
    // detect passive/non-passive-capable listeners via a no-op preventDefault
    // probe. Instead, just record whether window-level wheel is *being*
    // preventDefault'd (which would mean scroll wouldn't bubble to body).
    let prevented = false;
    const probe = (e) => { if (e.cancelable && e.defaultPrevented) prevented = true; };
    window.addEventListener('wheel', probe, { once: true, capture: true });
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true }));
    return { wheelPreventedByAuthor: prevented };
  });

  await page.screenshot({ path: path.join(SHOT_DIR, 'rauno-home-resting.png'), fullPage: false });
  await context.close();
  return { scroll, wheelProbe, wheelBurst, listenerInfo };
}

async function captureProjects(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('https://rauno.me/projects', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Full-page screenshot of the projects list.
  await page.screenshot({ path: path.join(SHOT_DIR, 'rauno-projects.png'), fullPage: true });

  const data = await page.evaluate(() => {
    function cs(el) { return getComputedStyle(el); }
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    }
    function pickAll(el) {
      const s = cs(el);
      const out = {};
      const keep = ['display', 'position', 'color', 'background-color', 'background',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'letter-spacing', 'text-transform', 'text-decoration', 'text-align',
        'padding', 'margin', 'gap', 'border', 'border-bottom', 'border-top',
        'width', 'height', 'max-width', 'min-width',
        'flex-direction', 'align-items', 'justify-content', 'grid-template-columns',
        'transition', 'transform', 'opacity', 'cursor'];
      for (const p of keep) out[p] = s.getPropertyValue(p);
      return out;
    }
    function describe(el) {
      if (!el) return null;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: typeof el.className === 'string' ? el.className : null,
        rect: rect(el),
        styles: pickAll(el),
        text: (el.innerText || '').slice(0, 500),
      };
    }

    const body = document.body;
    const html = document.documentElement;

    // Find the main list container. Heuristic: element that contains many
    // <a> links with short text and year-like text (2020-2026).
    const yearRe = /\b20\d{2}\b/;
    const allAnchors = Array.from(document.querySelectorAll('a'));
    const projAnchors = allAnchors.filter(a => {
      const t = a.innerText || '';
      return yearRe.test(t);
    });

    // Their common ancestor.
    function commonAncestor(els) {
      if (els.length === 0) return null;
      let cur = els[0];
      while (cur) {
        if (els.every(e => cur.contains(e))) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    const listContainer = commonAncestor(projAnchors);

    // Simulate hover on the first project row and capture the resulting
    // computed styles (transform/color/opacity).
    const hoverCaptures = [];
    const target = projAnchors[0];
    if (target) {
      const before = pickAll(target);
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      // Force :hover via inline pseudo — can't do that; but some JS listeners
      // apply classes on hover. Capture after dispatch.
      const after = pickAll(target);
      hoverCaptures.push({ before, after });
    }

    return {
      title: document.title,
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      html: describe(html),
      body: describe(body),
      listContainer: describe(listContainer),
      projectAnchorCount: projAnchors.length,
      projectAnchors: projAnchors.slice(0, 20).map(describe),
      hoverCaptures,
    };
  });

  // Take a separate hover screenshot by hovering on the first project anchor.
  const firstAnchor = await page.$('main a');
  if (firstAnchor) {
    await firstAnchor.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT_DIR, 'rauno-projects-hover.png'), fullPage: false });
  }

  await context.close();
  return data;
}

async function main() {
  const browser = await chromium.launch();
  console.log('[1/2] home carousel scroll mechanics…');
  const home = await captureHome(browser);
  console.log('[2/2] /projects layout + hover…');
  const projects = await captureProjects(browser);
  await browser.close();

  const out = { home, projects };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log('wrote', OUT_JSON);

  console.log('\n--- home scroll summary ---');
  console.log('html overflow:', home.scroll.htmlOverflow, '/ body overflow:', home.scroll.bodyOverflow);
  console.log('html scrollBehavior:', home.scroll.htmlScrollBehavior, '/ body scrollBehavior:', home.scroll.bodyScrollBehavior);
  console.log('documentHeight:', home.scroll.documentHeight, '/ viewportHeight:', home.scroll.viewportHeight);
  console.log('snap-candidate count:', home.scroll.snapCandidateCount);
  home.scroll.snapCandidates.forEach((s, i) => {
    console.log(`  [${i}] ${s.tag}.${(s.classes||'').slice(0,40)} scroll-snap-type=${s.scrollSnapType}`);
    console.log(`      children:`, s.childSnapAlign.map(c => c.scrollSnapAlign).join(','));
  });
  console.log('wheel probe:', home.wheelProbe);
  console.log('wheel burst positions:', home.wheelBurst.slice(-3));

  console.log('\n--- /projects summary ---');
  console.log('title:', projects.title);
  console.log('list container tag:', projects.listContainer && projects.listContainer.tag, 'classes:', projects.listContainer && projects.listContainer.classes);
  console.log('project anchor count:', projects.projectAnchorCount);
  if (projects.projectAnchors[0]) {
    console.log('first anchor rect:', projects.projectAnchors[0].rect);
    console.log('first anchor font:', projects.projectAnchors[0].styles['font-family'], projects.projectAnchors[0].styles['font-size'], projects.projectAnchors[0].styles['font-weight']);
    console.log('first anchor color:', projects.projectAnchors[0].styles.color);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
