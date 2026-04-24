// Rebuild study of kimdot.de — strip click triggers 2s "falling" keyframe
// animation (matches extracted @keyframes: translate3d(-100px, 640px, 0)
// with rotate -1.68° -> -5.27°), then navigates to the mailto link.

(function () {
  const ANIMATION_MS = 2000;
  document.querySelectorAll('.abriss').forEach((strip) => {
    strip.addEventListener('click', (e) => {
      e.preventDefault();
      if (strip.classList.contains('falling')) return;
      const link = strip.querySelector('a');
      const href = link && link.getAttribute('href');
      strip.classList.add('falling');
      if (href) setTimeout(() => { window.location.href = href; }, ANIMATION_MS);
    });
  });
})();
