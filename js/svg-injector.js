/**
 * SVG Icon Injector
 * Replaces <img src="...svg"> with inline <svg> so currentColor inherits from CSS.
 * Runs once on DOMContentLoaded — no filter hacks needed.
 */
(function() {
  const cache = {};
  const pending = new Map();

  function injectSVG(img) {
    const src = img.getAttribute('src');
    if (!src || !src.endsWith('.svg') || img.dataset.injected) return;

    // Copy classes and style from img to the future svg
    const cls = img.className;
    const style = img.getAttribute('style') || '';

    if (cache[src]) {
      replace(img, cache[src], cls, style);
    } else {
      if (!pending.has(src)) {
        pending.set(src, []);
        fetch(src).then(r => r.text()).then(svg => {
          cache[src] = svg;
          pending.get(src).forEach(({ img, cls, style }) => replace(img, svg, cls, style));
          pending.delete(src);
        }).catch(() => { pending.delete(src); });
      }
      // Queue only while the fetch is in flight — once cached, the branch
      // above replaces directly (pending entry no longer exists).
      pending.get(src).push({ img, cls, style });
    }
  }

  function replace(img, svgText, cls, style) {
    const tmp = document.createElement('div');
    tmp.innerHTML = svgText;
    const svg = tmp.querySelector('svg');
    if (!svg) return;

    // Transfer attributes from img to svg
    svg.setAttribute('class', cls);
    svg.setAttribute('style', style);
    if (!svg.getAttribute('width')) svg.setAttribute('width', '1em');
    if (!svg.getAttribute('height')) svg.setAttribute('height', '1em');

    img.replaceWith(svg);
  }

  function scan() {
    document.querySelectorAll('img[src$=".svg"]').forEach(injectSVG);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Also handle dynamically added icons (e.g. from i18n)
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
