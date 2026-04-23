// Acci4i0 — home carousel driver.
// Two-finger trackpad swipes (or mouse wheel) generate `wheel` events whose
// delta accumulates into a progress value (0..1) across the N cards.
// The .frames row translates horizontally; a wrapper .frames-scaler zooms to
// 0.78 while the user is actively navigating and eases back to 1.0 when idle,
// reproducing rauno.me's "preview vs focus" scale behavior.

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
  // Virtual scroll range: rauno.me traverses ~406px per card-transition
  // (4464px body-scroll across ~11 transitions). With N-1 transitions here,
  // MAX_SCROLL mirrors that pace 1:1.
  const MAX_SCROLL = 406 * (N - 1);

  let virtualScroll = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let targetScale = 1;
  let currentScale = 1;
  let activeIdx = -1;
  let lastInputTs = 0;

  function onWheel(e) {
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
})();
