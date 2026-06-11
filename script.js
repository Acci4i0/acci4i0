// Acci4i0 — home carousel driver (native-scroll edition).
//
// The body is made tall so the page has real vertical scroll. A fixed
// .center (1200x720, rauno.me's logical frame size) shows the cards; JS
// reads window.scrollY on scroll, turns it into a 0..1 progress value, and
// translates .frames horizontally from it. Native momentum / inertia /
// rubber-banding survive because we never preventDefault the vertical
// wheel — the browser handles scroll natively.
//
// .scaler carries two multiplied scales: a fit-scale so the fixed
// 1200x720 frame fits any viewport (rauno scales the strip, never resizes
// it), and the preview-scale that zooms to 0.784 while scrolling and eases
// back to 1.0 when idle.

(function () {
  const scaler = document.querySelector('.scaler');
  const frames = document.querySelector('.frames');
  const cards = Array.from(document.querySelectorAll('.frames > .frame'));
  const minimapLines = document.querySelector('.minimap__lines');
  const tracker = document.querySelector('.minimap__tracker');
  const N = cards.length;
  if (!scaler || !frames || !minimapLines || !tracker || N === 0) return;

  // Minimap: rauno renders a fixed strip of 20 lines (1x18px, 9px gap)
  // with a 30px tracker box sliding across it; lines under the box fade.
  const LINE_COUNT = 20;
  const LINE_STRIDE = 10; // 1px line + 9px gap
  const TRACKER_W = 30;
  const STRIP_W = LINE_COUNT * LINE_STRIDE - 9;
  for (let i = 0; i < LINE_COUNT; i++) {
    const line = document.createElement('div');
    line.className = 'line';
    minimapLines.appendChild(line);
  }
  const lines = Array.from(minimapLines.children);

  const FRAME_W = 1200;
  const FRAME_H = 720;
  const FRAME_STRIDE = 1240; // 1200px frame + 40px gap
  const PREVIEW_SCALE = 0.784314;
  const IDLE_MS = 360;
  const SCALE_LERP = 0.14;
  // rauno.me traverses ~406px of body-scroll per card transition.
  const PX_PER_TRANSITION = 406;
  const MAX_SCROLL = PX_PER_TRANSITION * (N - 1);

  let fitScale = 1;

  function measure() {
    document.body.style.minHeight = (MAX_SCROLL + window.innerHeight) + 'px';
    // Fit the fixed 1200x720 frame in the viewport, leaving room for the
    // minimap above (top: 64px + 18px) and the attribution below. On
    // narrow screens the side margin shrinks so the card stays prominent.
    const marginX = window.innerWidth < 700 ? 32 : 120;
    fitScale = Math.min(
      (window.innerWidth - marginX) / FRAME_W,
      (window.innerHeight - 200) / FRAME_H
    );
  }
  measure();

  let lastScrollTs = 0;
  let rafPending = false;
  let currentScale = 1;
  let trackerActive = false;

  function render() {
    rafPending = false;
    const scrollY = Math.max(0, Math.min(MAX_SCROLL, window.scrollY));
    const progress = MAX_SCROLL > 0 ? scrollY / MAX_SCROLL : 0;
    const exactIdx = progress * (N - 1);
    frames.style.transform = `translate3d(${-exactIdx * FRAME_STRIDE}px, 0, 0)`;

    const idle = performance.now() - lastScrollTs > IDLE_MS;
    const targetScale = idle ? 1 : PREVIEW_SCALE;
    currentScale += (targetScale - currentScale) * SCALE_LERP;
    if (Math.abs(currentScale - targetScale) < 0.001) currentScale = targetScale;
    scaler.style.transform = `scale(${fitScale * currentScale})`;

    // Tracker slides across the strip; it fills yellow while scrolling.
    const tx = progress * (STRIP_W - TRACKER_W);
    tracker.style.transform = `translateX(${tx}px)`;
    if (trackerActive === idle) {
      trackerActive = !idle;
      tracker.dataset.active = String(trackerActive);
    }
    for (let i = 0; i < LINE_COUNT; i++) {
      const center = i * LINE_STRIDE + 0.5;
      const under = center >= tx - 0.5 && center <= tx + TRACKER_W + 0.5;
      lines[i].dataset.fade = String(under);
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
  window.addEventListener('resize', () => { measure(); render(); });

  // Translate horizontal trackpad swipes (deltaX) into vertical scroll, so
  // left/right gestures advance the carousel — matching the visual flow.
  // Vertical wheel events fall through to native scroll, preserving inertia.
  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
      e.preventDefault();
      window.scrollBy(0, e.deltaX);
    }
  }, { passive: false });

  // Touch: rauno pans horizontally on coarse pointers. body has
  // touch-action: pan-y, so horizontal drags reach JS while vertical
  // swipes keep native scroll (which also drives the carousel).
  if (window.matchMedia('(pointer: coarse)').matches) {
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let inertiaRaf = 0;

    window.addEventListener('touchstart', (e) => {
      cancelAnimationFrame(inertiaRaf);
      lastX = e.touches[0].clientX;
      lastT = performance.now();
      vx = 0;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const x = e.touches[0].clientX;
      const t = performance.now();
      const dx = lastX - x;
      if (t > lastT) vx = dx / (t - lastT);
      lastX = x;
      lastT = t;
      if (dx !== 0) window.scrollBy(0, dx);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      // Simple momentum so a flick keeps the carousel gliding.
      function glide() {
        vx *= 0.95;
        if (Math.abs(vx) < 0.02) return;
        window.scrollBy(0, vx * 16);
        inertiaRaf = requestAnimationFrame(glide);
      }
      glide();
    }, { passive: true });
  }

  // Email copy: "Email" slides out, "Copied" slides in (rauno's contact card).
  const emailButton = document.querySelector('.email-button');
  const liveRegion = document.querySelector('.contact [aria-live]');
  if (emailButton) {
    let copiedTimer = 0;
    emailButton.addEventListener('click', () => {
      navigator.clipboard && navigator.clipboard.writeText('lando.andrea04@gmail.com');
      emailButton.classList.add('copied');
      if (liveRegion) liveRegion.textContent = 'Email copied to clipboard';
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        emailButton.classList.remove('copied');
        if (liveRegion) liveRegion.textContent = '';
      }, 1500);
    });
  }

  // Crosshair easter egg: toggle rauno's debug/wireframe mode.
  const cross = document.querySelector('.cross');
  const root = document.querySelector('main.root');
  if (cross && root) {
    cross.addEventListener('click', () => {
      root.dataset.debug = root.dataset.debug === 'true' ? 'false' : 'true';
    });
  }

  // Initial render (sets fit-scale and tracker before any scroll happens).
  requestAnimationFrame(render);
})();
