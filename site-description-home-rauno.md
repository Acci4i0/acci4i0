# Acci4i0 — Home Page (Rebuild Study of rauno.me)

## Objective

Rebuild the visual and interactive experience of `rauno.me` from scratch as the **home page** of Andrea Lando's portfolio. This is a **rebuild study**: write all HTML/CSS/JS from zero using measurements and patterns as the target. Do **not** fetch, download, or paste source from the original site.

## Stack

- Vanilla HTML + CSS + JS (no framework, no build step)
- Deploy: GitHub Pages, repo `Acci4i0`, URL `https://acci4i0.github.io/Acci4i0/`

## Repo Structure After This Build

```
/Acci4i0
├── index.html              ← THIS build (home)
├── style.css
├── script.js
├── /studies                ← built later, separate jobs
│   ├── /kimdot
│   ├── /sa-m
│   └── /endless-horse
├── /_tools                 ← Playwright extraction scripts
├── README.md
└── CREDITS.md
```

## Attribution Requirements

- **In-page footer**: small `<small>`, muted color (~#888), ~11px, centered:
  `After rauno.me by Rauno Freiberg — rebuild study ↗` where `↗` links to `https://rauno.me`.
- **CREDITS.md in root**: must list rauno.me alongside the other studies.

---

## Phase 1: Playwright Extraction (run BEFORE building)

Create `_tools/extract-rauno.js`. The script must open `https://rauno.me` at viewport 1280×800 (also try 390×844 for mobile comparison) and extract the following.

### Layout discovery

The original is a **card-based carousel**: horizontally swipeable/scrollable "pages", each with its own background color and content, with a progress indicator at the top showing current position.

Extract:
- Root container: `display`, `overflow`, `scroll-snap-type`, `grid-auto-flow`, `flex-direction`, `width`
- Count of top-level "cards" or sections
- Each card: `background-color`, `width`, `height`, `padding`, `border-radius`, `box-shadow`
- Card-to-card gap, margin, scroll-snap-align

### Top progress indicator

Many vertical tick marks `||||||` with one tick replaced by a rectangle box at the current position. As the user scrolls, the box moves along the tick strip.

Extract:
- Element type (div / svg / canvas)
- Number of ticks
- Tick dimensions, spacing
- Active indicator (rectangle) dimensions and positioning
- Transition/animation on indicator movement (duration, easing)
- Whether it's scroll-driven (CSS) or JS-controlled (IntersectionObserver / scroll listener)

### Typography

- `font-family` of body, headings, large display text (project name typography)
- `font-size`, `font-weight`, `line-height` for: body text, large display text, small labels
- Any custom fonts loaded via `@font-face` — list URLs

### Colors

- Background of page
- Background of each card type (white card, yellow card, etc.)
- Exact yellow hex
- Text color variants
- Link colors

### Interactive elements

- Yellow circle on bio card: what element is it? Decorative `<div>`? SVG? Is it interactive (click, drag)? Does it animate (pulse, rotate, follow cursor)?
- Project cards: how does the carousel scroll? Snap points? Momentum?
- Any hover/focus/active states on cards and links

### Animations & transitions

- `@keyframes` declared in stylesheets
- All `transition` declarations on visible elements
- Any scroll-driven animations
- Wait and observe: load the page, wait 5 seconds, record if any elements animate autonomously

Output: `_tools/rauno-values.json`

---

## Phase 2: Build

### High-level layout

A horizontally-scrolling sequence of cards on a light-grey background, with a progress indicator at the top. Cards represent distinct "screens" of the portfolio.

### Card sequence (7 cards total)

1. **Bio card** (white) — personal intro + decorative yellow circle
2. **Manifesto card** (yellow) — Andrea's personal credo (placeholder for now)
3. **Projects header card** — label "Projects"
4. **Project card 1** — `*/Andre.lndo` → `./studies/kimdot/`
5. **Project card 2** — `/cruci.v€rba^` → `./studies/sa-m/`
6. **Project card 3** — `cavallooo…` → `./studies/endless-horse/`
7. **Contact card** (white with yellow side stripe)

### Card: Bio

```html
<section class="card card--bio">
  <p class="bio">
    Andrea Lando is an Italian industrial engineer.
    He works at BBM S.p.A. on an industrial LLM platform,
    leading product strategy and client relations.
    Third of triplets — neither the first nor the second.
  </p>
  <div class="bio-ornament" aria-hidden="true"></div>
</section>
```

- `.bio-ornament` is the yellow circle overlay. Implement as a CSS-styled div: `position: absolute`, large `border-radius: 50%`, yellow fill (extract exact hex via Playwright), overlapping the text. Use `mix-blend-mode: multiply` or `difference` if extraction shows it.
- Bio text is black on white card; font-size large (~40-48px desktop, extract), generous line-height.
- Per-line indentation visible in the reference: extract whether this is `text-indent`, padding, or soft `<br>` line breaks.

### Card: Manifesto (yellow)

```html
<section class="card card--manifesto">
  <!-- TODO: Andrea's manifesto -->
  <p class="manifesto-placeholder">(manifesto pending)</p>
</section>
```

- Card background: bright yellow (extract exact value)
- Andrea will replace the placeholder by hand later. **Do NOT invent manifesto content. Do NOT copy from the reference site.**
- Same font as bio.

### Card: Projects header

```html
<section class="card card--projects-header">
  <h2>Projects</h2>
</section>
```

- Light-grey background to match the page (or transparent).
- Small label, top-left positioning.

### Card: Project (template, used 3 times)

```html
<a class="card card--project" href="./studies/kimdot/">
  <span class="project-name">*/Andre.lndo</span>
</a>
```

- Project names rendered in very large bold sans-serif, sized so they appear cut-off at card edges (matches reference: letters spill past card boundary).
- Implementation: `font-size` large, card has `overflow: hidden`.
- Card: white background, same width as bio/manifesto cards.
- Use the Unicode horizontal ellipsis character (U+2026, `…`) for the "…" in `cavallooo…` — not three separate dots.
- `/studies/sa-m/` and `/studies/endless-horse/` don't exist yet; their links will 404 until those studies are built. Do not create stub pages.

### Card: Contact

```html
<section class="card card--contact">
  <a class="contact__top-left" href="https://www.linkedin.com/in/andrea-lando-2a51833b3">LinkedIn · 2026</a>
  <a class="contact__center" href="mailto:lando.andrea04@gmail.com">Email</a>
  <span class="contact__bottom-left">2026</span>
  <a class="contact__bottom-right" href="https://github.com/Acci4i0">GitHub</a>
</section>
```

- Side stripe: thin yellow vertical bar on the left edge of the card (extract width and exact color from rauno reference).
- Links: underlined on hover, no decoration at rest.

### Top progress indicator (persistent)

Renders fixed at the top of the viewport. 7 ticks total (one per card). The tick corresponding to the currently-visible card is replaced by a small rectangle outline.

Implementation approach (confirm via Playwright extraction):
- Preferred: CSS scroll-driven animation if browser support is acceptable
- Otherwise: JS IntersectionObserver watching which card is centered, toggle `.active` on the corresponding tick
- Fallback: scroll listener computing centered card

### Carousel scroll behavior

- Horizontal scroll container with `scroll-snap-type: x mandatory`
- Each card has `scroll-snap-align: center`
- Mobile: native swipe
- Desktop: translate vertical wheel to horizontal scroll via JS, OR provide arrow buttons
- Extract via Playwright which behavior the original uses

### Typography

Use the font extracted from rauno.me. If it's a commercial license, substitute with the closest free alternative (Inter, Geist, or system `ui-sans-serif`).

---

## Build Checklist

1. ☐ Run Playwright extraction → `_tools/rauno-values.json`
2. ☐ Read JSON, confirm: card backgrounds, yellow hex, fonts, progress indicator behavior
3. ☐ Write `/index.html`, `/style.css`, `/script.js` from scratch
4. ☐ Use Andrea's bio exactly as specified
5. ☐ Use placeholder for manifesto (Andrea fills later)
6. ☐ Project cards exactly as specified (3 cards, custom display names)
7. ☐ Contact card exactly as specified
8. ☐ In-page footer attribution
9. ☐ Verify CREDITS.md is up to date
10. ☐ Test locally: `python3 -m http.server 8000`, visit home
11. ☐ Visually compare against `https://rauno.me`, iterate

## What NOT to do

- Do not copy text content from rauno.me: not the bio, not the manifesto, not the project names, not the footer text
- Do not fetch or paste CSS/JS from the original site
- Do not invent manifesto content for the placeholder card
- Do not create stub pages for `/studies/sa-m/` or `/studies/endless-horse/` (they will be built as separate jobs)
- Do not omit the footer attribution
