// v3 rauno.me extraction — focused on three things:
//   (1) Whether wheel.deltaX (horizontal trackpad swipe) advances the page
//       and how — direct scroll, transform mutation, or a custom handler.
//   (2) Carousel container's overflow / scroll-snap / scroll axis.
//   (3) The specific "Projects" card cover (typography, bg, decoration).
//
// Output: _tools/projects-cover-values.json (cover) + scroll-mechanics-v3.json.
// Screenshots dumped to _tools/snapshots/.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname);
const SHOT_DIR = path.join(__dirname, 'snapshots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
  });
  const page = await context.newPage();
  await page.goto('https://rauno.me', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // ---- (1) Wheel mechanics ---------------------------------------------------
  // Dispatch wheel events with various delta combinations and observe what
  // changes. Real (trusted) wheel events would scroll natively; synthetic
  // dispatched events do not — but they DO fire registered listeners. So we
  // dispatch deltaY and deltaX, then check (a) window.scrollY and (b) any
  // inline transform on suspected carousel containers.
  const mech = await page.evaluate(async () => {
    const log = [];
    const start = { scrollY: window.scrollY, scrollX: window.scrollX };
    const beforeBody = document.body.style.transform;

    // Capture transforms of all elements with non-trivial inline transform OR
    // transform set via stylesheet.
    function snapshotTransforms() {
      const out = [];
      const els = Array.from(document.querySelectorAll('body *'));
      for (const el of els) {
        const cs = getComputedStyle(el);
        const t = cs.transform;
        if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') {
          const r = el.getBoundingClientRect();
          if (r.width > 50 && r.height > 50) {
            out.push({
              tag: el.tagName.toLowerCase(),
              classes: typeof el.className === 'string' ? el.className.slice(0, 60) : null,
              rect: { w: Math.round(r.width), h: Math.round(r.height) },
              transform: t.slice(0, 200),
            });
          }
        }
      }
      return out.slice(0, 12);
    }

    const tBefore = snapshotTransforms();

    // Probe 1: deltaY vertical
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 200));
    log.push({ probe: 'deltaY+200', scrollY: window.scrollY, scrollX: window.scrollX });

    // Probe 2: deltaX horizontal
    window.dispatchEvent(new WheelEvent('wheel', { deltaX: 200, deltaY: 0, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 200));
    log.push({ probe: 'deltaX+200', scrollY: window.scrollY, scrollX: window.scrollX });

    const tAfter = snapshotTransforms();

    // Probe 3: real native scroll for comparison
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 200));
    window.scrollBy({ top: 800, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 200));
    log.push({ probe: 'scrollBy 800', scrollY: window.scrollY, scrollX: window.scrollX, transformsAfter: snapshotTransforms() });

    // Reset
    window.scrollTo(0, 0);

    // Search for any element registering wheel handler attributes (data-* or
    // common event-attribute hints; cannot truly enumerate JS listeners).
    const allEls = Array.from(document.querySelectorAll('body *'));
    const overflowable = allEls.filter(el => {
      const s = getComputedStyle(el);
      return s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowY === 'scroll' || s.overflowY === 'auto';
    }).slice(0, 8).map(el => ({
      tag: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className.slice(0, 60) : null,
      overflowX: getComputedStyle(el).overflowX,
      overflowY: getComputedStyle(el).overflowY,
      scrollSnapType: getComputedStyle(el).scrollSnapType,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    return { log, tBefore, tAfter, overflowable, htmlOverflow: getComputedStyle(document.documentElement).overflow, bodyOverflow: getComputedStyle(document.body).overflow, documentHeight: document.documentElement.scrollHeight, documentWidth: document.documentElement.scrollWidth };
  });

  // Real horizontal swipe — Playwright supports `mouse.wheel(dx, dy)` which
  // fires trusted wheel events. Use that to see if the page actually responds
  // to horizontal trackpad input.
  await page.mouse.move(640, 400);
  const beforeY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(200, 0); // deltaX=200, deltaY=0
  await page.waitForTimeout(300);
  const afterDeltaX = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.wheel(0, 200); // deltaY=200
  await page.waitForTimeout(300);
  const afterDeltaY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, 0));

  // ---- (2) Each carousel "card" — find the Projects card --------------------
  // rauno's home has many cards; we want the one whose label/text reads
  // "Projects". Walk the document tree, find a card-shaped element with that
  // text.
  const projectsCard = await page.evaluate(() => {
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    }
    function pickAll(el) {
      const s = getComputedStyle(el);
      const out = {};
      const keep = ['display','position','color','background-color','background-image','background',
        'font-family','font-size','font-weight','line-height','letter-spacing','text-transform',
        'padding','margin','border','border-radius','box-shadow','width','height',
        'flex-direction','align-items','justify-content','overflow','transform','transform-origin'];
      for (const p of keep) out[p] = s.getPropertyValue(p);
      return out;
    }

    // Find candidates: elements containing the text "Projects" exactly.
    const all = Array.from(document.querySelectorAll('body *'));
    const candidates = all.filter(el => {
      const t = (el.innerText || '').trim();
      return t === 'Projects' || t.startsWith('Projects\n') || t === 'Projects\nView all projects';
    });

    // Walk up from each candidate, find the first ancestor that looks like a
    // card (>= 600px wide, has padding or background, position absolute/relative).
    function findCard(el) {
      let cur = el;
      while (cur && cur !== document.body) {
        const r = cur.getBoundingClientRect();
        const cs = getComputedStyle(cur);
        if (r.width >= 600 && r.height >= 300 && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.padding !== '0px')) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    }

    const seen = new Set();
    const cards = [];
    for (const c of candidates) {
      const card = findCard(c);
      if (card && !seen.has(card)) {
        seen.add(card);
        cards.push({
          tag: card.tagName.toLowerCase(),
          classes: typeof card.className === 'string' ? card.className.slice(0, 80) : null,
          rect: rect(card),
          styles: pickAll(card),
          innerText: card.innerText.slice(0, 400),
          childTags: Array.from(card.children).map(c => c.tagName.toLowerCase()),
        });
      }
    }
    return { found: cards.length, cards };
  });

  // ---- (3) Screenshot the Projects card by scrolling it into the viewport --
  // rauno's home uses native vertical scroll to advance horizontally; the
  // Projects card is somewhere along that axis. Scroll through and find a
  // position where the card text "Projects" is centered.
  await page.evaluate(() => window.scrollTo(0, 0));
  const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log('docHeight:', docHeight);

  // Try ~12 scroll positions; at each, screenshot a thumbnail and check if
  // "Projects" card-like text is centered.
  let bestY = null;
  for (let y = 0; y <= docHeight - 800; y += 400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(400);
    // Capture the visible "Projects" presence near the center of the viewport.
    const centered = await page.evaluate(() => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      const el = document.elementFromPoint(cx, cy);
      if (!el) return null;
      // Walk up to find the wrapping card.
      let cur = el;
      while (cur && cur !== document.body) {
        const r = cur.getBoundingClientRect();
        if (r.width >= 800 && r.height >= 400) {
          return { text: cur.innerText.slice(0, 200), tag: cur.tagName.toLowerCase(), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
        }
        cur = cur.parentElement;
      }
      return null;
    });
    if (centered && (centered.text || '').match(/^Projects(\s|$)/m)) {
      bestY = y;
      break;
    }
  }
  if (bestY != null) {
    console.log('Projects card centered at scrollY ≈', bestY);
    await page.screenshot({ path: path.join(SHOT_DIR, 'rauno-projects-card.png') });
    // Get its computed values too.
    const detail = await page.evaluate(() => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      let cur = document.elementFromPoint(cx, cy);
      while (cur && cur !== document.body) {
        const r = cur.getBoundingClientRect();
        if (r.width >= 800 && r.height >= 400) break;
        cur = cur.parentElement;
      }
      if (!cur || cur === document.body) return null;
      function pickAll(el) {
        const s = getComputedStyle(el);
        const out = {};
        for (let i = 0; i < s.length; i++) {
          const p = s[i];
          const v = s.getPropertyValue(p);
          if (v && v !== '0px' && v !== 'normal' && v !== 'auto' && v !== 'rgba(0, 0, 0, 0)' && v !== 'none' && v !== '') out[p] = v;
        }
        return out;
      }
      const r = cur.getBoundingClientRect();
      return {
        tag: cur.tagName.toLowerCase(),
        classes: typeof cur.className === 'string' ? cur.className : null,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        innerHTML_snippet: cur.innerHTML.slice(0, 600),
        innerText: cur.innerText.slice(0, 400),
        styles: pickAll(cur),
        children: Array.from(cur.children).slice(0, 8).map(ch => ({
          tag: ch.tagName.toLowerCase(),
          classes: typeof ch.className === 'string' ? ch.className : null,
          rect: (() => { const rr = ch.getBoundingClientRect(); return { x: Math.round(rr.x), y: Math.round(rr.y), w: Math.round(rr.width), h: Math.round(rr.height) }; })(),
          styles: pickAll(ch),
          innerText: ch.innerText ? ch.innerText.slice(0, 200) : null,
        })),
      };
    });
    fs.writeFileSync(path.join(OUT_DIR, 'projects-cover-values.json'), JSON.stringify(detail, null, 2));
    console.log('wrote projects-cover-values.json');
  } else {
    console.log('Could not auto-locate the Projects card; manual check needed');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'scroll-mechanics-v3.json'), JSON.stringify({
    mechanism: mech,
    trustedWheel: { beforeY, afterDeltaX_via_horizontalWheel: afterDeltaX, afterDeltaY_via_verticalWheel: afterDeltaY },
  }, null, 2));
  console.log('wrote scroll-mechanics-v3.json');

  await browser.close();

  // Print summary
  console.log('\n=== scroll mechanics summary ===');
  console.log('document size:', mech.documentWidth + ' × ' + mech.documentHeight);
  console.log('html/body overflow:', mech.htmlOverflow, '/', mech.bodyOverflow);
  console.log('overflowable elements:', mech.overflowable.length);
  console.log('horizontal trackpad swipe (mouse.wheel(200, 0)) → scrollY:', afterDeltaX);
  console.log('vertical trackpad swipe   (mouse.wheel(0, 200)) → scrollY:', afterDeltaY);
  console.log('=== projects card summary ===');
  console.log('candidates found:', projectsCard.found);
  if (projectsCard.cards.length > 0) {
    console.log('first card classes:', projectsCard.cards[0].classes);
    console.log('first card rect:', projectsCard.cards[0].rect);
    console.log('first card bg:', projectsCard.cards[0].styles['background-color'], '/', projectsCard.cards[0].styles['background-image']);
    console.log('first card text:', projectsCard.cards[0].innerText.slice(0, 200));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
