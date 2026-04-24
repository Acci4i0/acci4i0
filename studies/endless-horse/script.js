// Rebuild study of endless.horse — append an 18-line leg segment each time
// the sentinel enters the viewport. The footer is pushed further down every
// append so scrolling never catches up to the bottom.

(function () {
  const horse = document.querySelector('.horse');
  const sentinel = document.querySelector('.sentinel');
  if (!horse || !sentinel) return;

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
      if (e.isIntersecting) horse.appendChild(makeSegment());
    }
  }, { rootMargin: '400px' });

  io.observe(sentinel);
})();
