/* Event-name text overlay: a title and an optional second line.

   State (resolution independent, like the logo):
     title, sub   the two lines (sub is optional)
     font         font family id (see FONTS)
     weight       400 | 700 | 900
     color        '#rrggbb'
     size         title cap size as a fraction of the screen height
     anchor       'tl' 't' 'tr' 'l' 'c' 'r' 'bl' 'b' 'br' or 'custom'
     margin       gap to the edge as a fraction of min(W, H)
     cx, cy       centre as fractions of W / H (for 'custom')
     shadow       soft drop shadow for readability on busy backgrounds */
(function (global) {
  'use strict';

  const FONTS = [
    { id: 'Cairo', name: 'Cairo' },
    { id: 'Tajawal', name: 'Tajawal' },
    { id: 'Almarai', name: 'Almarai' },
    { id: 'Montserrat', name: 'Montserrat (English)' },
  ];
  const SUB_SCALE = 0.42;
  const LINE = 1.3;

  const family = f => `"${f}", "Segoe UI", Tahoma, Arial, sans-serif`;
  const isArabic = s => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);

  let measureCtx = null;
  function mctx() {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    return measureCtx;
  }

  function lines(T) {
    const out = [];
    if (T.title && T.title.trim()) out.push({ text: T.title.trim(), k: 1, weight: T.weight });
    if (T.sub && T.sub.trim()) out.push({ text: T.sub.trim(), k: SUB_SCALE, weight: Math.min(T.weight, 400) });
    return out;
  }

  function measure(ctx, ls, T, px) {
    let w = 0, h = 0;
    const out = ls.map(l => {
      const size = px * l.k;
      ctx.font = `${l.weight} ${size}px ${family(T.font)}`;
      const lw = ctx.measureText(l.text).width;
      w = Math.max(w, lw);
      h += size * LINE;
      return { ...l, size, w: lw, lh: size * LINE };
    });
    return { w, h, lines: out };
  }

  /** Layout on a W×H frame: {x, y, w, h, lines, align} or null when empty. */
  function layout(T, W, H) {
    const ls = lines(T);
    if (!ls.length) return null;
    const ctx = mctx();
    const m = T.margin * Math.min(W, H);
    let px = T.size * H;
    let r = measure(ctx, ls, T, px);
    const maxW = Math.max(1, W - 2 * m), maxH = Math.max(1, H - 2 * m);
    const fit = Math.min(1, maxW / (r.w || 1), maxH / (r.h || 1)); // never wider/taller than the screen
    if (fit < 1) { px *= fit; r = measure(ctx, ls, T, px); }

    let cx, cy;
    const a = T.anchor || 'c';
    if (a === 'custom') { cx = T.cx * W; cy = T.cy * H; }
    else {
      cx = a.includes('l') ? m + r.w / 2 : a.includes('r') ? W - m - r.w / 2 : W / 2;
      cy = a.includes('t') ? m + r.h / 2 : a.includes('b') ? H - m - r.h / 2 : H / 2;
    }
    const align = a !== 'custom' && a.includes('l') ? 'left' : a !== 'custom' && a.includes('r') ? 'right' : 'center';
    return { x: cx - r.w / 2, y: cy - r.h / 2, w: r.w, h: r.h, lines: r.lines, align, px };
  }

  function draw(ctx, T, W, H) {
    const L = layout(T, W, H);
    if (!L) return;
    ctx.save();
    ctx.fillStyle = T.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = L.align;
    if (T.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = L.px * 0.18;
      ctx.shadowOffsetY = L.px * 0.04;
    }
    const x = L.align === 'left' ? L.x : L.align === 'right' ? L.x + L.w : L.x + L.w / 2;
    let y = L.y;
    L.lines.forEach(l => {
      ctx.font = `${l.weight} ${l.size}px ${family(T.font)}`;
      ctx.direction = isArabic(l.text) ? 'rtl' : 'ltr';
      ctx.fillText(l.text, x, y + l.lh / 2);
      y += l.lh;
    });
    ctx.restore();
  }

  /** Resolve once the chosen font is ready (or after 3 s, using a fallback). */
  function ready(T) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const sample = ((T.title || '') + (T.sub || '')) || 'Aa أب';
    const loads = [T.weight, Math.min(T.weight, 400)].map(w => document.fonts.load(`${w} 64px "${T.font}"`, sample));
    return Promise.race([
      Promise.all(loads).catch(() => {}),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  }

  global.EventText = { FONTS, layout, draw, ready };
})(window);
