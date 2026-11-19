/* Frosted panel behind the logo or the event name, so they stay readable on
   busy or bright backgrounds. Used by the backgrounds page (preview, PNG, MP4)
   and the screensaver.

   Backdrop.draw(ctx, rect, o, W, H)
     rect  the element's box {x, y, w, h} in canvas pixels
     o     { blur: 0..1, dim: 0..1 }
   Call it inside Anim.apply, just before drawing the element, so the panel
   moves and fades with it. It blurs whatever is already on the canvas. */
(function (global) {
  'use strict';

  let tmp = null, tctx = null;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // The canvas, blurred: drawn small with a small blur, then scaled back up.
  // Cheap enough for every video frame, and the same look at any resolution.
  function blurred(src, W, H, radius) {
    if (!tmp) { tmp = document.createElement('canvas'); tctx = tmp.getContext('2d'); }
    const hasFilter = typeof tctx.filter === 'string';
    const k = Math.max(1, Math.min(32, hasFilter ? radius / 3 : radius / 1.5));
    const sw = Math.max(1, Math.round(W / k)), sh = Math.max(1, Math.round(H / k));
    if (tmp.width !== sw || tmp.height !== sh) { tmp.width = sw; tmp.height = sh; }
    tctx.save();
    tctx.clearRect(0, 0, sw, sh);
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    // no filter (older Safari): the downscale alone softens it
    if (hasFilter) tctx.filter = `blur(${(radius / k).toFixed(2)}px)`;
    tctx.drawImage(src, 0, 0, W, H, 0, 0, sw, sh);
    tctx.restore();
    return tmp;
  }

  function draw(ctx, rect, o, W, H) {
    const blur = Math.max(0, Math.min(1, o.blur || 0)), dim = Math.max(0, Math.min(1, o.dim || 0));
    if (!blur && !dim) return;
    const m = Math.min(W, H);
    const pad = m * 0.02 + Math.min(rect.w, rect.h) * 0.12;
    // keep the panel on screen when the element sits near an edge
    const x = Math.max(0, rect.x - pad), y = Math.max(0, rect.y - pad);
    const w = Math.min(W, rect.x + rect.w + pad) - x, h = Math.min(H, rect.y + rect.h + pad) - y;
    const r = Math.min(m * 0.02, h / 2, w / 2);
    const img = blur ? blurred(ctx.canvas, W, H, blur * m * 0.04) : null;

    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    // the clip follows the motion transform; the blurred copy stays in place
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (img) ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);
    if (dim) { ctx.fillStyle = `rgba(0,0,0,${(dim * 0.7).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    ctx.restore();

    // hairline edge, like frosted glass
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.lineWidth = Math.max(1, m / 900);
    ctx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.1 * blur).toFixed(3)})`;
    ctx.stroke();
    ctx.restore();
  }

  global.Backdrop = { draw };
})(window);
