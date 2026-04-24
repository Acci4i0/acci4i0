// Acci4i0 — home carousel driver (native-scroll edition).
//
// The body is made tall so the page has real vertical scroll. A fixed
// .viewport shows the cards; JS reads window.scrollY on scroll, turns it
// into a 0..1 progress value, and translates .frames horizontally from it.
// Native momentum / inertia / rubber-banding survive because we never
// preventDefault the wheel event — the browser handles scroll natively.
// A wrapper .frames-scaler zooms to 0.78 while scrolling and eases back
// to 1.0 when idle, reproducing rauno.me's "preview vs focus" scale.

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

  const PREVIEW_SCALE = 0.784314;
  const IDLE_MS = 360;
  const SCALE_LERP = 0.14;
  // rauno.me traverses ~406px of body-scroll per card transition.
  const PX_PER_TRANSITION = 406;
  const MAX_SCROLL = PX_PER_TRANSITION * (N - 1);

  function setBodyHeight() {
    document.body.style.minHeight = (MAX_SCROLL + window.innerHeight) + 'px';
  }
  setBodyHeight();

  function frameStride() {
    const cardW = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(frames).gap) || 0;
    return cardW + gap;
  }

  let lastScrollTs = 0;
  let rafPending = false;
  let currentScale = 1;
  let activeIdx = -1;

  function render() {
    rafPending = false;
    const scrollY = Math.max(0, Math.min(MAX_SCROLL, window.scrollY));
    const progress = MAX_SCROLL > 0 ? scrollY / MAX_SCROLL : 0;
    const exactIdx = progress * (N - 1);
    const translateX = -exactIdx * frameStride();
    frames.style.transform = `translate3d(${translateX}px, 0, 0)`;

    const idle = performance.now() - lastScrollTs > IDLE_MS;
    const targetScale = idle ? 1 : PREVIEW_SCALE;
    currentScale += (targetScale - currentScale) * SCALE_LERP;
    if (Math.abs(currentScale - targetScale) < 0.001) currentScale = targetScale;
    scaler.style.transform = `scale(${currentScale})`;

    const idx = Math.round(exactIdx);
    if (idx !== activeIdx) {
      if (activeIdx >= 0 && ticks[activeIdx]) ticks[activeIdx].classList.remove('active');
      if (ticks[idx]) ticks[idx].classList.add('active');
      activeIdx = idx;
    }

    // Keep rAF running while the scale is still animating toward target.
    if (!idle || Math.abs(currentScale - 1) > 0.001) {
      rafPending = true;
      requestAnimationFrame(render);
    }
  }

  function onScroll() {
    lastScrollTs = performance.now();
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(render);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { setBodyHeight(); render(); });
  // Initial render (so the active tick is set before any scroll happens).
  requestAnimationFrame(render);
})();
