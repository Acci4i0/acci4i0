// Find and extract the "History of Software Design" card on rauno.me. The
// card cover has a small label at top + a giant typographic display element.
// We walk through scroll positions, find when the card is centered in the
// viewport (its rect x ≈ (viewportW - cardW)/2), and dump every descendant.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('https://rauno.me', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Step 1: walk scroll, find each scrollY where History of Software Design
  // card is closest to centered.
  let bestY = null;
  let bestDx = Infinity;
  for (let y = 0; y <= 8000; y += 50) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(40);
    const r = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.index_frame__XKrH1, [class*="index_frame"]'));
      for (const c of cards) {
        const t = (c.innerText || '').trim();
        if (/^History of Software Design$/i.test(t.split('\n')[0])) {
          const r = c.getBoundingClientRect();
          return { x: r.x, w: r.width };
        }
      }
      return null;
    });
    if (!r) continue;
    const center = r.x + r.w / 2;
    const dx = Math.abs(center - 640); // viewport center
    if (dx < bestDx) { bestDx = dx; bestY = y; }
  }

  if (bestY === null) {
    console.log('History of Software Design card never appeared');
    await browser.close();
    process.exit(1);
  }

  console.log('Best center scrollY=', bestY, 'dx=', bestDx);
  await page.evaluate((yy) => window.scrollTo(0, yy), bestY);
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(__dirname, 'snapshots', 'rauno-history-sw-design-card.png') });

  function pickAllSrc() {
    return function (el) {
      const s = getComputedStyle(el);
      const out = {};
      const wanted = [
        'background-color', 'background-image', 'background',
        'border-radius', 'box-shadow',
        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'overflow', 'overflow-x', 'overflow-y',
        'display', 'position', 'top', 'right', 'bottom', 'left',
        'transform', 'transform-origin', 'zoom',
        'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
        'font-family', 'font-size', 'font-weight', 'font-style',
        'line-height', 'letter-spacing', 'text-transform', 'text-align', 'white-space',
        'color', 'opacity',
      ];
      for (const p of wanted) {
        const v = s.getPropertyValue(p);
        if (v && v !== '' && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== 'rgba(0, 0, 0, 0)') {
          out[p] = v;
        }
      }
      return out;
    };
  }

  const data = await page.evaluate((src) => {
    const pickAll = new Function('return (' + src + ')()')();

    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }

    function describe(el, depth, maxDepth) {
      const innerText = (el.innerText || '').slice(0, 200);
      const out = {
        tag: el.tagName.toLowerCase(),
        classes: typeof el.className === 'string' ? el.className : null,
        rect: rect(el),
        styles: pickAll(el),
      };
      if (innerText) out.innerText = innerText;
      // Also note inline style attribute, useful for animations.
      const styleAttr = el.getAttribute('style');
      if (styleAttr) out.styleAttr = styleAttr;
      if (depth < maxDepth) {
        out.children = Array.from(el.children).map(c => describe(c, depth + 1, maxDepth));
      }
      return out;
    }

    const cards = Array.from(document.querySelectorAll('[class*="index_frame"]'));
    let cardEl = null;
    for (const c of cards) {
      const t = (c.innerText || '').trim().split('\n')[0];
      if (/^History of Software Design$/i.test(t)) { cardEl = c; break; }
    }
    if (!cardEl) return { error: 'no card' };

    return {
      cardSelector: cardEl.tagName.toLowerCase() + '.' + cardEl.className,
      card: describe(cardEl, 0, 6),
    };
  }, pickAllSrc.toString());

  // Build a clean summary
  function findByPredicate(node, pred, out = []) {
    if (!node) return out;
    if (pred(node)) out.push(node);
    if (node.children) for (const c of node.children) findByPredicate(c, pred, out);
    return out;
  }

  const card = data.card;
  const labelNodes = findByPredicate(card, n => n.innerText && n.innerText.trim() === 'History of Software Design' && (!n.children || n.children.length < 2));
  const label = labelNodes[0] || null;

  // Find children with giant text (font-size > 60px) — likely the cover display.
  const allNodes = findByPredicate(card, () => true);
  const bigText = allNodes.filter(n => {
    const fs = parseFloat((n.styles && n.styles['font-size']) || '0');
    return fs > 60;
  });

  const summary = {
    cardRect: card.rect,
    cardClasses: card.classes,
    cardStyles: card.styles,
    labelRect: label ? label.rect : null,
    labelStyles: label ? label.styles : null,
    bigTextElements: bigText.map(n => ({
      tag: n.tag,
      classes: n.classes,
      rect: n.rect,
      innerText: n.innerText,
      styles: n.styles,
    })),
  };

  fs.writeFileSync(path.join(__dirname, 'projects-cover-values.json'), JSON.stringify({
    sourceUrl: 'https://rauno.me',
    referenceCard: 'History of Software Design',
    foundAtScrollY: bestY,
    summary,
    fullDetail: data,
  }, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
})();
