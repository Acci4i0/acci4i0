// Acci4i0 — home carousel driver + inline study interactions.
//
// Two-finger trackpad swipes (or mouse wheel) generate `wheel` events whose
// delta accumulates into a progress value (0..1) across the N cards.
// The .frames row translates horizontally; a wrapper .frames-scaler zooms to
// 0.78 while the user is actively navigating and eases back to 1.0 when idle,
// reproducing rauno.me's "preview vs focus" scale behavior.
//
// Two study cards hook into the wheel path:
//   - .card--study-horse contains an internally scrollable stage
//     (endless.horse). While the wheel target is inside that stage AND the
//     stage can still scroll in the wheel direction, the carousel yields
//     control so the page grows vertically instead of advancing.
//   - .card--study-kimdot strips animate with the kimdot "falling" keyframe
//     on click, then invoke the mailto: link.

(function () {
  const scaler = document.querySelector('.frames-scaler');
  const frames = document.querySelector('.frames');
  const cards = Array.from(document.querySelectorAll('.frames > .card'));
  const minimap = document.querySelector('.minimap__ticks');
  const N = cards.length;

  if (!scaler || !frames || !minimap || N === 0) return;

  for (let i = 0; i < N; i++) {
    const tick = document.createElement('span');
    tick.className = 'tick';
    minimap.appendChild(tick);
  }
  const ticks = Array.from(minimap.children);

  function frameStride() {
    const cardW = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(frames).gap) || 0;
    return cardW + gap;
  }

  const PREVIEW_SCALE = 0.784314;
  const IDLE_MS = 360;
  const LERP_PROGRESS = 0.12;
  const LERP_SCALE = 0.14;
  const EPS = 0.0005;
  const MAX_SCROLL = 406 * (N - 1);

  let virtualScroll = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let targetScale = 1;
  let currentScale = 1;
  let activeIdx = -1;
  let lastInputTs = 0;

  function onWheel(e) {
    // If wheel originates inside an internal scroller that can still absorb
    // scroll in this direction, yield native behavior (no preventDefault, no
    // virtualScroll advance). This is what makes the endless.horse card
    // grow legs instead of switching slides.
    const scroller = e.target.closest && e.target.closest('[data-internal-scroll]');
    if (scroller) {
      const dir = (e.deltaY + e.deltaX) > 0 ? 1 : -1;
      const atTop = scroller.scrollTop <= 0;
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      if ((dir > 0 && !atBottom) || (dir < 0 && !atTop)) return;
    }

    e.preventDefault();
    const delta = e.deltaX + e.deltaY;
    virtualScroll = Math.max(0, Math.min(MAX_SCROLL, virtualScroll + delta));
    targetProgress = virtualScroll / MAX_SCROLL;
    targetScale = PREVIEW_SCALE;
    lastInputTs = performance.now();
  }

  function render() {
    const exactIdx = currentProgress * (N - 1);
    const translateX = -exactIdx * frameStride();
    frames.style.transform = `translate3d(${translateX}px, 0, 0)`;
    scaler.style.transform = `scale(${currentScale})`;

    const idx = Math.round(exactIdx);
    if (idx !== activeIdx) {
      if (activeIdx >= 0 && ticks[activeIdx]) ticks[activeIdx].classList.remove('active');
      if (ticks[idx]) ticks[idx].classList.add('active');
      activeIdx = idx;
    }
  }

  function loop() {
    if (performance.now() - lastInputTs > IDLE_MS) targetScale = 1;

    const dp = targetProgress - currentProgress;
    const ds = targetScale - currentScale;
    currentProgress = Math.abs(dp) < EPS ? targetProgress : currentProgress + dp * LERP_PROGRESS;
    currentScale = Math.abs(ds) < EPS ? targetScale : currentScale + ds * LERP_SCALE;

    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', render);
  requestAnimationFrame(loop);

  // ---------- Study: kimdot — strip "falling" click behavior ----------
  const KIMDOT_ANIMATION_MS = 2000;
  document.querySelectorAll('.study-stage--kimdot .abriss').forEach((strip) => {
    strip.addEventListener('click', (e) => {
      e.preventDefault();
      if (strip.classList.contains('falling')) return;
      const link = strip.querySelector('a');
      const href = link && link.getAttribute('href');
      strip.classList.add('falling');
      if (href) setTimeout(() => { window.location.href = href; }, KIMDOT_ANIMATION_MS);
    });
  });

  // ---------- Study: endless.horse — append legs as sentinel enters view ----
  const horseStage = document.querySelector('.study-stage--horse');
  const horseSentinel = document.querySelector('.horse-sentinel');
  if (horseStage && horseSentinel && 'IntersectionObserver' in window) {
    const LINE = '\t       | | | |             || |';
    const LINES_PER_SEGMENT = 18;
    function makeSegment() {
      const pre = document.createElement('pre');
      pre.className = 'horse-legs';
      pre.textContent = Array(LINES_PER_SEGMENT).fill(LINE).join('\n') + '\n';
      return pre;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          horseStage.insertBefore(makeSegment(), horseSentinel);
        }
      }
    }, { root: horseStage, rootMargin: '400px' });
    io.observe(horseSentinel);
  }
})();
