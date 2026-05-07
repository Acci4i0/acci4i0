// More aggressive search for the rauno.me Projects card. Walks the document
// at every 100px scrollY, logs what visible elements have "Projects" text,
// captures the one that's most center-aligned, takes a screenshot.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('https://rauno.me', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const centerX = 640;

  let best = null;
  for (let y = 0; y < docH - 800; y += 100) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(150);
    const found = await page.evaluate((cx) => {
      const all = Array.from(document.querySelectorAll('body *'));
      const matches = [];
      for (const el of all) {
        const t = (el.innerText || '').trim();
        if (t === 'Projects' || t === 'Projects\nView all projects' || t.startsWith('Projects\n')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.width >= 100) {
            matches.push({ tag: el.tagName.toLowerCase(), text: t.slice(0, 80), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
          }
        }
      }
      return matches;
    }, centerX);
    if (found.length === 0) continue;
    // Find the one whose center.x is closest to centerX.
    found.sort((a, b) => Math.abs((a.rect.x + a.rect.w/2) - centerX) - Math.abs((b.rect.x + b.rect.w/2) - centerX));
    const top = found[0];
    const dx = Math.abs((top.rect.x + top.rect.w/2) - centerX);
    if (!best || dx < best.dx) {
      best = { y, dx, top, allFound: found };
      if (dx < 100) break; // good enough — stop early
    }
  }

  console.log('best y:', best && best.y, 'dx from center:', best && best.dx);
  console.log('top match:', best && best.top);

  if (best) {
    await page.evaluate((yy) => window.scrollTo(0, yy), best.y);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(__dirname, 'snapshots', 'rauno-projects-card.png') });

    // Walk up from the matched element until we hit a "card-shaped" container.
    const detail = await page.evaluate(() => {
      // Find the "Projects" element first
      const all = Array.from(document.querySelectorAll('body *'));
      const target = all.find(el => {
        const t = (el.innerText || '').trim();
        return t === 'Projects' || t === 'Projects\nView all projects';
      });
      if (!target) return null;
      // Walk up to a card-sized parent
      let cur = target;
      while (cur && cur !== document.body) {
        const r = cur.getBoundingClientRect();
        if (r.width >= 700 && r.height >= 400) break;
        cur = cur.parentElement;
      }
      if (!cur || cur === document.body) return { note: 'no card-sized ancestor', target: { tag: target.tagName.toLowerCase(), classes: target.className, text: target.innerText.slice(0, 100) } };

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

      return {
        card: {
          tag: cur.tagName.toLowerCase(),
          classes: typeof cur.className === 'string' ? cur.className : null,
          rect: rect(cur),
          styles: pickAll(cur),
          innerText: cur.innerText.slice(0, 600),
        },
        children: Array.from(cur.children).map(ch => ({
          tag: ch.tagName.toLowerCase(),
          classes: typeof ch.className === 'string' ? ch.className : null,
          rect: rect(ch),
          styles: pickAll(ch),
          innerText: (ch.innerText || '').slice(0, 300),
          childTags: Array.from(ch.children).map(c => c.tagName.toLowerCase()).slice(0, 10),
        })),
      };
    });

    fs.writeFileSync(path.join(__dirname, 'projects-cover-values.json'), JSON.stringify({
      bestScrollY: best.y,
      detail,
    }, null, 2));
    console.log('wrote projects-cover-values.json');
  }
  await browser.close();
})();
