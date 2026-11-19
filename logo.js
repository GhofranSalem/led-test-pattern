/* Logo overlay: load an SVG/PNG, place it on the frame, and check whether a
   raster logo is big enough for the chosen resolution.

   Layout state (all resolution independent):
     size     logo height as a fraction of the screen height
     anchor   'tl' 't' 'tr' 'l' 'c' 'r' 'bl' 'b' 'br' or 'custom'
     margin   gap to the edge as a fraction of min(W, H)  (for anchors)
     cx, cy   logo centre as fractions of W / H           (for 'custom')
     opacity  0..1 */
(function (global) {
  'use strict';

  const STORE_KEY = 'ledabs.logo';

  function readAs(file, how) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r[how](file);
    });
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('decode'));
      img.src = src;
    });
  }

  // Make sure the SVG has an intrinsic size (many exported SVGs only have a
  // viewBox), otherwise browsers draw it at 300×150 or not at all.
  function normaliseSvg(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('svg');
    const num = v => (v && /^[\d.]+(px)?$/.test(v.trim()) ? parseFloat(v) : 0);
    let w = num(svg.getAttribute('width')), h = num(svg.getAttribute('height'));
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if ((!w || !h) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      if (!w && !h) { w = vb[2]; h = vb[3]; }
      else if (!w) w = h * vb[2] / vb[3];
      else h = w * vb[3] / vb[2];
    }
    if (!w || !h) { w = w || 1000; h = h || 1000; }
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return {
      text: new XMLSerializer().serializeToString(svg),
      w, h,
      hasRaster: !!svg.querySelector('image'),
    };
  }

  /** Load from a File. Resolves {img, kind:'svg'|'raster', natW, natH, name, src, hasRaster} */
  async function fromFile(file) {
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    if (isSvg) {
      const n = normaliseSvg(await readAs(file, 'readAsText'));
      const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(n.text);
      const img = await loadImage(src);
      return { img, kind: 'svg', natW: n.w, natH: n.h, name: file.name, src, hasRaster: n.hasRaster };
    }
    if (!/^image\//.test(file.type)) throw new Error('type');
    const src = await readAs(file, 'readAsDataURL');
    const img = await loadImage(src);
    return { img, kind: 'raster', natW: img.naturalWidth, natH: img.naturalHeight, name: file.name, src, hasRaster: true };
  }

  async function fromStored(o) {
    const img = await loadImage(o.src);
    return { ...o, img };
  }

  function store(logo) {
    try {
      if (!logo) { localStorage.removeItem(STORE_KEY); return true; }
      const { img, ...rest } = logo;
      localStorage.setItem(STORE_KEY, JSON.stringify(rest));
      return true;
    } catch { return false; }
  }

  function stored() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
  }

  /** Pixel rectangle of the logo on a W×H frame. */
  function rect(logo, L, W, H) {
    const ar = logo.natW / logo.natH;
    let h = L.size * H, w = h * ar;
    if (w > W) { w = W; h = w / ar; } // never wider than the screen
    let cx, cy;
    if (L.anchor === 'custom') {
      cx = L.cx * W; cy = L.cy * H;
    } else {
      const m = L.margin * Math.min(W, H);
      const a = L.anchor || 'c';
      cx = a.includes('l') ? m + w / 2 : a.includes('r') ? W - m - w / 2 : W / 2;
      cy = a.includes('t') ? m + h / 2 : a.includes('b') ? H - m - h / 2 : H / 2;
    }
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  function draw(ctx, logo, L, W, H) {
    if (!logo) return;
    const r = rect(logo, L, W, H);
    ctx.save();
    ctx.globalAlpha *= L.opacity;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo.img, r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  /** How much a raster logo gets enlarged at full resolution (1 = native). */
  function upscale(logo, L, W, H) {
    if (!logo || logo.kind === 'svg') return 0;
    const r = rect(logo, L, W, H);
    return r.h / logo.natH;
  }

  global.Logo = { fromFile, fromStored, store, stored, rect, draw, upscale };
})(window);
