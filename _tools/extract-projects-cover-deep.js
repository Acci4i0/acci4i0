// Drill into the rauno Projects card cover to find the giant "Projects"
// wordmark element and its styling.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('https://rauno.me', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Center the Projects card.
  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.waitForTimeout(500);

  const data = await page.evaluate(() => {
    function rect(el) { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
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

    // Find every element whose innerText is exactly "Projects".
    const all = Array.from(document.querySelectorAll('body *'));
    const out = [];
    for (const el of all) {
      const t = (el.innerText || '').trim();
      if (t === 'Projects') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          out.push({
            tag: el.tagName.toLowerCase(),
            classes: typeof el.className === 'string' ? el.className : null,
            rect: rect(el),
            styles: pickAll(el),
            childTagCount: el.children.length,
            outerHTML_snippet: el.outerHTML.slice(0, 250),
          });
        }
      }
    }
    return out;
  });

  fs.writeFileSync(path.join(__dirname, 'projects-cover-deep.json'), JSON.stringify(data, null, 2));
  console.log('found', data.length, 'elements with text "Projects"');
  data.forEach((e, i) => {
    console.log(`\n[${i}] ${e.tag}.${(e.classes||'').slice(0,40)} rect=${JSON.stringify(e.rect)} children=${e.childTagCount}`);
    console.log('  font-size:', e.styles['font-size'], 'weight:', e.styles['font-weight']);
    console.log('  color:', e.styles['color']);
    console.log('  bg-color:', e.styles['background-color']);
    console.log('  position:', e.styles['position'], 'transform:', (e.styles['transform']||'').slice(0,80));
    console.log('  outerHTML:', e.outerHTML_snippet.slice(0, 200));
  });
  await browser.close();
})();
