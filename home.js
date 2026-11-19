/* Live previews on the home page tool cards, drawn with the real generators. */
(function () {
  'use strict';

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // test pattern card: static
  const tp = document.getElementById('prevTest');
  if (tp && window.TestPattern) {
    TestPattern.draw(tp.getContext('2d'), tp.width, tp.height, {
      bg: 'black', grid: true, gridStep: 40,
      cabOn: true, cabinets: true, cabCols: 10, cabRows: 4, cabW: 80, cabH: 85,
      circles: true, cross: true, border: true, info: true, event: '', screen: '',
    });
  }

  // style counts in the card text, from the real list (I18n.apply fills them in)
  const f1 = document.getElementById('abF1');
  if (f1 && window.Abstract) {
    const n = k => window.Abstract.STYLES.filter(s => s.kind === k).length;
    f1.dataset.i18nVars = JSON.stringify({ a: n('animated'), s: n('static') });
    I18n.apply();
  }

  // abstract card: slowly cycles through the styles
  const ab = document.getElementById('prevAbstract');
  if (!ab || !window.Abstract) return;
  const ctx = ab.getContext('2d', { alpha: false });
  const { STYLES, PALETTES, render } = window.Abstract;
  const looks = [
    ['waterfall', 'ocean'], ['waves', 'ocean'], ['aurora', 'aurora'], ['coderain', 'aurora'], ['retrogrid', 'neon'], ['blobs', 'neon'],
    ['constellation', 'ocean'], ['flow', 'aurora'], ['starfield', 'pastel'], ['bokeh', 'sunset'],
    ['ripples', 'corporate'], ['stripes', 'gold'], ['stagelights', 'neon'], ['arabesque', 'gold'], ['silk', 'ocean'],
  ].filter(([s]) => STYLES.some(x => x.id === s));
  const SECS = 6;
  const start = performance.now();
  let visible = true;

  function frame(now) {
    const el = Math.max(0, now - start) / 1000; // rAF timestamps can precede `start`
    const i = Math.floor(el / SECS) % looks.length;
    const [style, pal] = looks[i];
    const palette = PALETTES.find(p => p.id === pal).colors;
    render(ctx, ab.width, ab.height, (el % SECS) / SECS, { style, palette, seed: 7 + i, density: 0.5, grain: false, speed: 1 });
  }

  if (reduce) { frame(start); return; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(ab);
  }
  (function loop(now) {
    if (visible) frame(now);
    requestAnimationFrame(loop);
  })(performance.now());
})();
