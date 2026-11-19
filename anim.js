/* Motion for the logo and event name in videos (and the playing preview).

   Intro types (fade, slide, zoom) animate in at the start and back out at
   the end, so the clip still loops cleanly: the last frame and the first
   frame both have the element hidden. Loop types (float, pulse) use whole
   cycles over the clip, so they are seamless too. PNG stills never animate. */
(function (global) {
  'use strict';

  const TYPES = [
    { id: 'none', name: 'بدون حركة' },
    { id: 'fade', name: 'ظهور واختفاء تدريجي' },
    { id: 'slide', name: 'طلوع من تحت' },
    { id: 'zoom', name: 'تكبير مع الظهور' },
    { id: 'float', name: 'طفو هادي (loop)' },
    { id: 'pulse', name: 'نبض (loop)' },
  ];
  const IDENTITY = { alpha: 1, dy: 0, scale: 1 };
  const ease = x => 1 - Math.pow(1 - x, 3);
  const clamp01 = x => Math.min(1, Math.max(0, x));

  /**
   * @param {string} type
   * @param {number} t      0..1 position in the clip
   * @param {number} secs   clip length in seconds
   * @param {number} delay  seconds to wait before animating in (and to leave earlier)
   * @returns {{alpha:number, dy:number, scale:number}} dy is a fraction of the screen height
   */
  function at(type, t, secs, delay) {
    if (!type || type === 'none') return IDENTITY;
    if (type === 'float' || type === 'pulse') {
      const n = Math.max(1, Math.round(secs / 4)); // ~4 s per cycle, whole cycles only
      const w = Math.sin(2 * Math.PI * t * n);
      return type === 'float' ? { alpha: 1, dy: w * 0.012, scale: 1 } : { alpha: 1, dy: 0, scale: 1 + 0.03 * w };
    }
    const s = t * secs;
    const D = Math.min(1.2, secs * 0.15);
    const d = Math.min(delay || 0, secs * 0.1);
    const k = ease(Math.min(clamp01((s - d) / D), clamp01((secs - s - d) / D)));
    if (type === 'fade') return { alpha: k, dy: 0, scale: 1 };
    if (type === 'slide') return { alpha: k, dy: (1 - k) * 0.05, scale: 1 };
    if (type === 'zoom') return { alpha: k, dy: 0, scale: 0.8 + 0.2 * k };
    return IDENTITY;
  }

  /** Draw with the motion state applied around the element centre (cx, cy). */
  function apply(ctx, st, cx, cy, H, draw) {
    if (st.alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= st.alpha;
    ctx.translate(cx, cy + st.dy * H);
    ctx.scale(st.scale, st.scale);
    ctx.translate(-cx, -cy);
    draw();
    ctx.restore();
  }

  global.Anim = { TYPES, at, apply };
})(window);
