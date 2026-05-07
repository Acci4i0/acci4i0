// Locate and screenshot rauno.me's "Projects" card (the carousel cover that
// links to /projects/), then extract its computed values.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOT = path.join(__dirname, 'snapshots');
const OUT = path.join(__dirname, 'projects-cover-values.json');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('https://rauno.me', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const docH = await page.evaluate(() => document.documentElement.scrollHeight);

  // Walk scrollY from 0 to docH-800 in 200px steps, and at each step check
  // what's centered. When "Projects" text shows up centered, capture.
  const centerX = 640, centerY = 400;
  let bestY = null;
  let bestSnapshot = null;
  for (let y = 0; y < docH; y += 200) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(250);
    const info = await page.evaluate(({ cx, cy }) => {
      let el = document.elementFromPoint(cx, cy);
      while (el && el !== document.body) {
        const r = el.getBoundingClientRect();
        if (r.width >= 800 && r.height >= 400) return { text: (el.innerText || '').slice(0, 200), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
        el = el.parentElement;
      }
      return null;
    }, { cx: centerX, cy: centerY });
    if (info && /^Projects(\s|$)/m.test(info.text || '')) {
      bestY = y;
      bestSnapshot = info;
      break;
    }
  }

  if (bestY === null) {
    // Try one more pass with finer steps in the suspected region.
    for (let y = 3000; y < 4200; y += 50) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(180);
      const info = await page.evaluate(({ cx, cy }) => {
        let el = document.elementFromPoint(cx, cy);
        while (el && el !== document.body) {
          const r = el.getBoundingClientRect();
          if (r.width >= 800 && r.height >= 400) return { text: (el.innerText || '').slice(0, 200), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
          el = el.parentElement;
        }
        return null;
      }, { cx: centerX, cy: centerY });
      if (info && /^Projects(\s|$)/m.test(info.text || '')) { bestY = y; bestSnapshot = info; break; }
    }
  }

  console.log('best scrollY for Projects card:', bestY);
  console.log('snapshot:', bestSnapshot);

  if (bestY !== null) {
    await page.screenshot({ path: path.join(SHOT, 'rauno-projects-card.png'), fullPage: false });

    const detail = await page.evaluate(({ cx, cy }) => {
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
      function rect(el) { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
      let el = document.elementFromPoint(cx, cy);
      while (el && el !== document.body) {
        const r = el.getBoundingClientRect();
        if (r.width >= 800 && r.height >= 400) break;
        el = el.parentElement;
      }
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName.toLowerCase(),
        classes: typeof el.className === 'string' ? el.className : null,
        rect: rect(el),
        styles: pickAll(el),
        innerText: el.innerText.slice(0, 600),
        children: Array.from(el.children).map(ch => ({
          tag: ch.tagName.toLowerCase(),
          classes: typeof ch.className === 'string' ? ch.className : null,
          rect: rect(ch),
          styles: pickAll(ch),
          innerText: (ch.innerText || '').slice(0, 200),
          childTags: Array.from(ch.children).map(c => c.tagName.toLowerCase()),
        })),
      };
    }, { cx: centerX, cy: centerY });
    fs.writeFileSync(OUT, JSON.stringify(detail, null, 2));
    console.log('wrote', OUT);
  }
  await browser.close();
})();
