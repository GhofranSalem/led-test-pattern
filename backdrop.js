/* Glass panel behind the logo or the event name, so they stay readable on
   busy or bright backgrounds. Used by the backgrounds page (preview, PNG, MP4)
   and the screensaver.

   Options (per element):
     mode      'off' | 'box' (around the element) | 'band' (full screen width)
     blur      0..1  how much of the background is blurred
     dim       0..1  darkening
     shine     0..1  glass look: rim light, top highlight, slight lens and colour boost
     fade      'none' | 'all' | 't' | 'b' | 'l' | 'r' | 'tb' | 'lr'  edges that fade out
     fadeSize  0..1  how far the fade reaches into the panel

   Backdrop.draw(ctx, rect, o, W, H) — call it inside Anim.apply, just before
   drawing the element, so the panel moves and fades with it. It works on
   whatever is already on the canvas. */
(function (global) {
  'use strict';

  const MODES = ['off', 'box', 'band'];
  const FADES = ['none', 'all', 't', 'b', 'l', 'r', 'tb', 'lr'];
  const DEFAULTS = { mode: 'off', blur: 0.6, dim: 0.2, shine: 0.6, fade: 'none', fadeSize: 0.35 };

  const clamp01 = v => Math.max(0, Math.min(1, v));
  const num = (v, d) => (v !== undefined && v !== '' && isFinite(+v) ? clamp01(+v) : d);

  // URL fields, in order: blur, dim, mode, shine, fade, fadeSize
  function serialize(o) { return [o.blur, o.dim, o.mode, o.shine, o.fade, o.fadeSize]; }
  function parse(f) {
    const o = { ...DEFAULTS };
    o.blur = num(f[0], o.blur); o.dim = num(f[1], o.dim);
    if (MODES.includes(f[2])) o.mode = f[2];
    // links from before the modes had only blur and dim: either one on meant a panel
    else if (f[0] !== undefined) { o.mode = +f[0] > 0 || +f[1] > 0 ? 'box' : 'off'; o.shine = 0.3; }
    o.shine = num(f[3], o.shine);
    if (FADES.includes(f[4])) o.fade = f[4];
    o.fadeSize = num(f[5], o.fadeSize);
    return o;
  }

  let tmp = null, tctx = null, layer = null, lctx = null;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // The canvas blurred: drawn small with a small blur, then scaled back up.
  // Cheap enough for every video frame, and the same look at any resolution.
  function blurred(src, W, H, radius, shine) {
    if (!tmp) { tmp = document.createElement('canvas'); tctx = tmp.getContext('2d'); }
    const hasFilter = typeof tctx.filter === 'string';
    const k = Math.max(1, Math.min(32, hasFilter ? radius / 3 : radius / 1.5));
    const sw = Math.max(1, Math.round(W / k)), sh = Math.max(1, Math.round(H / k));
    if (tmp.width !== sw || tmp.height !== sh) { tmp.width = sw; tmp.height = sh; }
    tctx.save();
    tctx.clearRect(0, 0, sw, sh);
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    // glass makes what's behind it a little richer; older Safari has no filter and gets the downscale only
    if (hasFilter) tctx.filter = `blur(${(radius / k).toFixed(2)}px) saturate(${(1 + 0.5 * shine).toFixed(2)})`;
    tctx.drawImage(src, 0, 0, W, H, 0, 0, sw, sh);
    tctx.restore();
    return tmp;
  }

  function fadeMask(L, w, h, fade, size) {
    const sides = fade === 'all' ? 'tblr' : fade === 'tb' ? 'tb' : fade === 'lr' ? 'lr' : fade;
    L.globalCompositeOperation = 'destination-in';
    for (const s of sides) {
      const vert = s === 't' || s === 'b';
      const len = vert ? h : w;
      const f = Math.max(0.001, Math.min(1, size * 0.5 * (fade === 'all' ? Math.min(w, h) / len : 1)));
      const g = vert ? L.createLinearGradient(0, s === 't' ? 0 : h, 0, s === 't' ? h : 0)
        : L.createLinearGradient(s === 'l' ? 0 : w, 0, s === 'l' ? w : 0, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(f, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      L.fillStyle = g;
      L.fillRect(0, 0, w, h);
    }
    L.globalCompositeOperation = 'source-over';
  }

  function draw(ctx, rect, o, W, H) {
    if (!o || !o.mode || o.mode === 'off') return;
    const blur = clamp01(o.blur || 0), dim = clamp01(o.dim || 0), shine = clamp01(o.shine || 0);
    const m = Math.min(W, H);
    const pad = m * 0.025 + Math.min(rect.w, rect.h) * 0.12;

    // panel box in screen pixels: follow the motion transform (translate + scale)
    const tr = ctx.getTransform();
    const map = (x, y) => [tr.a * x + tr.c * y + tr.e, tr.b * x + tr.d * y + tr.f];
    let [x0, y0] = map(rect.x - pad, rect.y - pad);
    let [x1, y1] = map(rect.x + rect.w + pad, rect.y + rect.h + pad);
    if (o.mode === 'band') { x0 = 0; x1 = W; }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    const w = x1 - x0, h = y1 - y0;
    if (w < 2 || h < 2) return;
    const r = o.mode === 'band' ? 0 : Math.min(m * 0.035, h / 2, w / 2);

    if (!layer) { layer = document.createElement('canvas'); lctx = layer.getContext('2d'); }
    if (layer.width !== w || layer.height !== h) { layer.width = w; layer.height = h; } // resizing also clears
    const L = lctx;
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalAlpha = 1;
    L.clearRect(0, 0, w, h);

    L.save();
    roundRect(L, 0, 0, w, h, r);
    L.clip();
    if (blur > 0) {
      const img = blurred(ctx.canvas, W, H, blur * m * 0.04, shine);
      // a slight magnification about the panel centre reads as a glass lens
      const lens = 1 + 0.04 * shine;
      L.imageSmoothingEnabled = true;
      L.imageSmoothingQuality = 'high';
      L.drawImage(img, 0, 0, img.width, img.height, w / 2 + (-x0 - w / 2) * lens, h / 2 + (-y0 - h / 2) * lens, W * lens, H * lens);
    }
    if (dim > 0) { L.fillStyle = `rgba(0,0,0,${(dim * 0.7).toFixed(3)})`; L.fillRect(0, 0, w, h); }
    if (shine > 0) {
      // frost, then a soft highlight across the top
      L.fillStyle = `rgba(255,255,255,${(0.02 + 0.05 * shine).toFixed(3)})`;
      L.fillRect(0, 0, w, h);
      const top = L.createLinearGradient(0, 0, 0, h * 0.6);
      top.addColorStop(0, `rgba(255,255,255,${(0.2 * shine).toFixed(3)})`);
      top.addColorStop(1, 'rgba(255,255,255,0)');
      L.fillStyle = top;
      L.fillRect(0, 0, w, h);
    }
    // rim light: bright on the top-left and bottom-right edges (inner half only, it's clipped)
    const rim = L.createLinearGradient(0, 0, w, h);
    const a = (v) => `rgba(255,255,255,${v.toFixed(3)})`;
    rim.addColorStop(0, a(0.08 + 0.55 * shine));
    rim.addColorStop(0.35, a(0.04 + 0.04 * shine));
    rim.addColorStop(0.65, a(0.03));
    rim.addColorStop(1, a(0.05 + 0.3 * shine));
    L.strokeStyle = rim;
    L.lineWidth = Math.max(2, m * 0.004);
    if (o.mode === 'band') { L.beginPath(); L.moveTo(0, 0); L.lineTo(w, 0); L.moveTo(0, h); L.lineTo(w, h); }
    else roundRect(L, 0, 0, w, h, r);
    L.stroke();
    L.restore();

    if (o.fade && o.fade !== 'none') fadeMask(L, w, h, o.fade, clamp01(o.fadeSize || 0));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, x0, y0); // keeps the motion fade (globalAlpha)
    ctx.restore();
  }

  global.Backdrop = { MODES, FADES, DEFAULTS, parse, serialize, draw };
})(window);
