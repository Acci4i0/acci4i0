# Acci4i0 — Home Page (Rebuild Study of kimdot.de)

## Objective

Rebuild the visual and interactive experience of `kimdot.de` from scratch as a learning exercise. This is a **rebuild study**, not a copy: write all HTML/CSS/JS from zero using the measurements and patterns below as the target. Do **not** download or paste source code from the original site.

## Stack

- Vanilla HTML + CSS + JS (no framework, no build step)
- jQuery optional; prefer vanilla JS
- Deploy: GitHub Pages, repo `Acci4i0`, home at the root (`/index.html`)

## Repository Structure (this file describes only the root/home)

```
/Acci4i0
├── index.html          ← this home page
├── style.css
├── script.js
├── /studies            ← other rebuild studies (future)
├── README.md           ← 3-line note about rebuild studies
└── CREDITS.md          ← credits to original authors
```

## Attribution Requirements (non-negotiable)

1. **In-page footer**: small `<small>` at the very bottom, muted color, font ~11px, text: `After kimdot.de by Kim Wermes ↗` where `↗` links to `https://kimdot.de`.
2. **README.md** top section, 3 lines: note that the repo contains rebuild studies of admired sites, reconstructed from scratch as exercises, originals credited in `CREDITS.md`.
3. **CREDITS.md**: lists each study folder with original URL and author.

---

## Design Target (values extracted from the original)

### Page shell

- Body background: `rgb(211, 211, 211)` (lightgray)
- Body: fixed width behavior, no padding/margin
- Main container: centered horizontally (flex)
- Font: serif, browser default (Times New Roman family), 16px base

### Paper card (the white rectangle)

```
.paper           → white wrapper
.paper-top       → contains bio + Kontakt & Legal toggle
.paper-bottom    → flex row containing strips
```

- `.paper-top`:
  - width: 352px
  - background: `#fff`
  - padding: 32px (2rem) all sides
  - `border-bottom: 1px dotted #000` (the dotted line separating bio from strips)
- `.paper-bottom`:
  - display: flex (row)
  - width: 352px (same as paper-top, aligned)
  - min-height: ~210px
  - no padding, no gap (strips touch each other via their own borders)

### Strip component (`.abriss`)

Each strip is a vertical tab with rotated text, like a tear-off flyer tab.

```
.abriss {
  flex: 1;                                /* equal width, auto-distributed */
  flex-direction: column;
  justify-content: center;
  background: #fff;
  border-inline: 0.5px solid #000;        /* vertical separators */
  font-size: 16px;
  cursor: pointer;
}
```

- Text inside must read vertically bottom-to-top: use `writing-mode: vertical-rl` and `transform: rotate(180deg)` on the text container (or equivalent). Confirm exact property via the Playwright extraction script.
- Strip inner content: an `<a>` link, blue underlined (browser default link style works: `color: blue; text-decoration: underline`).

### Interactions

**1. "Kontakt & Legal" toggle**

- Native `<details><summary>` element with default browser disclosure triangle (▶ → ▼)
- Inside: address + email link + phone link
- Semantic HTML, no JS needed

**2. Strip "falling" animation** ⭐ (the core effect)

When a strip is clicked:
- A class `.falling` is added to that strip
- The strip rotates forward/down as if being torn off the bottom edge
- `transform-origin` is at the **top** of the strip (the strip hinges from where it meets the dotted line)
- After the animation completes, the browser navigates to the strip's target URL

Target behavior values (confirm precise numbers via Playwright extraction, script provided separately — `extract-kimdot.js`):

- `transition` on `.abriss`: ~500–800ms, easing likely `ease-in` or `cubic-bezier` (extract actual value)
- `.abriss.falling transform`: a rotation around the X or Z axis of roughly 80–100° forward (extract actual value)
- Parent `.paper-bottom` likely has `perspective` set for 3D (extract actual value)
- Redirect delay (JS `setTimeout` before `location.href`): match the transition duration

**Implementation pattern (write from scratch):**

```js
// pseudocode — rewrite cleanly
document.querySelectorAll('.abriss').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    el.classList.add('falling');
    const href = el.querySelector('a').href;
    setTimeout(() => { window.location.href = href; }, ANIMATION_MS);
  });
});
```

---

## Personal Content (this is what goes in the card)

### Bio (inside `.paper-top`, before the toggle)

> Andrea Lando is the third of triplets, a generic irony that reminds him every day that he is neither the first nor the second. He is a Bassano-based Industrial Engineer. He works at BBM S.p.A. in a [strategic and commercial role](https://www.linkedin.com/in/andrea-lando-2a51833b3), where he leads the development and commercialization of an industrial LLM platform. His work spans product roadmap, pricing strategy, and client relations.

- The inline link on "strategic and commercial role" points to LinkedIn: `https://www.linkedin.com/in/andrea-lando-2a51833b3?utm_source=share_via&utm_content=profile&utm_medium=member_ios`
- Link style: default blue underlined

### Kontakt & Legal (collapsible `<details>`)

```
▼ Kontakt & Legal
Belvedere di Tezze sul Brenta, Strada del Confine 43.
E-Mail, Tel.: +39 333 7216052
```

- "E-Mail" is the word itself rendered as a link → `mailto:lando.andrea04@gmail.com`
- "+39 333 7216052" is a `tel:` link

### Strips (exactly 3)

Distributed evenly across `.paper-bottom` via `flex: 1`:

| Position | Display text | Href |
|---|---|---|
| 1 | `cavallooo…` | `https://endless.horse` |
| 2 | `*A/bout me` | `https://sa-m.fr` |
| 3 | `#loa~ding` | `https://loading-gamma.vercel.app` |

Each strip is a `.abriss` element. Text is rotated vertically as described above.

### Footer attribution (small, muted, bottom of page)

```html
<footer>
  <small>After <a href="https://kimdot.de">kimdot.de</a> by Kim Wermes — rebuild study</small>
</footer>
```

Style: ~11px, color `#888` or similar muted tone, center-aligned, padding-top generous so it doesn't crowd the paper card.

---

## Build Checklist for Claude Code

1. Run the Playwright extraction script first (`extract-kimdot.js`) → produces `kimdot-values.json` with exact values for the `.falling` class, `writing-mode`, `transition` timing, and computed font-family.
2. Write `index.html` from scratch — semantic HTML, no copy-paste from the original.
3. Write `style.css` from scratch using the values above + the JSON.
4. Write `script.js` from scratch for the click → add class → redirect pattern.
5. Test locally with `python3 -m http.server` or similar.
6. Visual diff against `https://kimdot.de` side-by-side. Iterate on timing and rotation values until the animation feels right.
7. Add README.md (3 lines) and CREDITS.md.
8. Commit to `Acci4i0` repo. Enable GitHub Pages from `main` branch root.

## What NOT to do

- Do not fetch the original site's `style.css` or `scripts.js` and paste contents.
- Do not use the original's bio text, even modified.
- Do not omit the footer attribution.
- Do not mimic the original's `mailto:kimwermes@gmail.com` — use Andrea's email.
