// Rebuild study of kimdot.de — click a strip, it "falls" (2s ease animation
// translating down + left with a slight rotation), then navigates to the
// strip's target URL. Matches the extracted @keyframes falling timing.

(function () {
  const ANIMATION_MS = 2000;

  document.querySelectorAll('.abriss').forEach((strip) => {
    strip.addEventListener('click', (e) => {
      e.preventDefault();
      if (strip.classList.contains('falling')) return;

      const href = strip.dataset.href
        || strip.querySelector('a')?.getAttribute('href');
      if (!href) return;

      strip.classList.add('falling');
      setTimeout(() => { window.location.href = href; }, ANIMATION_MS);
    });
  });
})();
