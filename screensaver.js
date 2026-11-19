/* Full-screen live player for screensaver apps (Lively Wallpaper on Windows,
   WebViewScreenSaver on macOS) or any browser in full screen.

   Settings come from the URL hash in the same format as abstract.html, so the
   "Copy screensaver link" button there produces a link that plays the exact
   same look, at whatever resolution the monitor has, forever. */
(function () {
  'use strict';

  const { STYLES, PALETTES, render } = window.Abstract;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });

  // ---------------------------------------------------------------- settings
  const S = {
    style: 'blobs', palette: PALETTES[0].colors.slice(), seed: 20261119, density: 0.5, grain: true, speed: 1, secs: 30,
    logo: { size: 0.25, anchor: 'br', margin: 0.05, cx: 0.5, cy: 0.5, opacity: 1, anim: 'none', blur: 0, dim: 0 },
    text: { title: '', sub: '', font: 'Cairo', weight: 700, color: '#ffffff', size: 0.12, anchor: 'c', margin: 0.05, cx: 0.5, cy: 0.5, shadow: true, anim: 'none', blur: 0, dim: 0 },
  };

  (function parse() {
    const p = new URLSearchParams(location.hash.slice(1));
    const num = (k, lo, hi) => { if (p.has(k) && isFinite(+p.get(k))) S[k] = Math.min(hi, Math.max(lo, +p.get(k))); };
    num('seed', 0, 2 ** 31); num('density', 0, 1); num('speed', 1, 4); num('secs', 1, 600);
    if (p.has('grain')) S.grain = p.get('grain') === '1';
    if (p.has('style') && STYLES.some(s => s.id === p.get('style'))) S.style = p.get('style');
    if (p.has('pal')) {
      const cols = p.get('pal').split('-').filter(c => /^[0-9a-f]{6}$/i.test(c)).map(c => '#' + c.toLowerCase());
      if (cols.length === 5) S.palette = cols;
    }
    const n = (v, lo, hi, d) => (v !== undefined && v !== '' && isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
    const anims = Anim.TYPES.map(a => a.id);
    if (p.has('logo')) {
      const [size, anchor, margin, cx, cy, opacity, anim, blur, dim] = p.get('logo').split('~');
      const L = S.logo;
      L.size = n(size, 0.03, 1, L.size);
      if (/^(tl|t|tr|l|c|r|bl|b|br|custom)$/.test(anchor)) L.anchor = anchor;
      L.margin = n(margin, 0, 0.25, L.margin);
      L.cx = n(cx, 0, 1, L.cx); L.cy = n(cy, 0, 1, L.cy);
      L.opacity = n(opacity, 0.1, 1, L.opacity);
      if (anims.includes(anim)) L.anim = anim;
      L.blur = n(blur, 0, 1, 0); L.dim = n(dim, 0, 1, 0);
    }
    const T = S.text;
    if (p.has('title')) T.title = p.get('title').slice(0, 200);
    if (p.has('sub')) T.sub = p.get('sub').slice(0, 200);
    if (p.has('txt')) {
      const [font, weight, color, sz, anchor, margin, cx, cy, shadow, anim, blur, dim] = p.get('txt').split('~');
      if (EventText.FONTS.some(f => f.id === font)) T.font = font;
      if (['400', '700', '900'].includes(weight)) T.weight = +weight;
      if (/^[0-9a-f]{6}$/i.test(color || '')) T.color = '#' + color.toLowerCase();
      T.size = n(sz, 0.02, 0.6, T.size);
      if (/^(tl|t|tr|l|c|r|bl|b|br|custom)$/.test(anchor)) T.anchor = anchor;
      T.margin = n(margin, 0, 0.25, T.margin);
      T.cx = n(cx, 0, 1, T.cx); T.cy = n(cy, 0, 1, T.cy);
      T.shadow = shadow !== '0';
      if (anims.includes(anim)) T.anim = anim;
      T.blur = n(blur, 0, 1, 0); T.dim = n(dim, 0, 1, 0);
    }
  })();

  const params = { style: S.style, palette: S.palette, seed: S.seed, density: S.density, grain: S.grain, speed: S.speed };
  const isStatic = (STYLES.find(s => s.id === S.style) || STYLES[0]).kind === 'static';

  // The logo lives in this browser's storage only (screensaver apps have their own).
  let logo = null;
  const stored = Logo.stored();
  if (stored && stored.src) Logo.fromStored(stored).then(l => { logo = l; bgCache = null; }).catch(() => {});

  // ---------------------------------------------------------------- sizing
  // Cap the internal size so animation stays smooth on 4K+ monitors.
  const MAX_PIXELS = 3.7e6;
  let W = 0, H = 0, bgCache = null;
  function resize() {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(dpr, Math.sqrt(MAX_PIXELS / (cssW * cssH)));
    W = Math.max(1, Math.round(cssW * scale));
    H = Math.max(1, Math.round(cssH * scale));
    canvas.width = W;
    canvas.height = H;
    bgCache = null;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- frames
  function overlays(t) {
    if (logo) {
      const r = Logo.rect(logo, S.logo, W, H);
      Anim.apply(ctx, Anim.at(S.logo.anim, t, S.secs, 0), r.x + r.w / 2, r.y + r.h / 2, H, () => {
        Backdrop.draw(ctx, r, S.logo, W, H);
        Logo.draw(ctx, logo, S.logo, W, H);
      });
    }
    const L = EventText.layout(S.text, W, H);
    if (L) {
      const delay = logo && S.logo.anim !== 'none' ? 0.3 : 0;
      Anim.apply(ctx, Anim.at(S.text.anim, t, S.secs, delay), L.x + L.w / 2, L.y + L.h / 2, H, () => {
        Backdrop.draw(ctx, L, S.text, W, H);
        EventText.draw(ctx, S.text, W, H);
      });
    }
  }

  const overlaysMove = () => S.logo.anim !== 'none' || S.text.anim !== 'none';
  const start = performance.now();
  function frame(now) {
    const t = ((Math.max(0, now - start) / 1000) / S.secs) % 1;
    if (isStatic) {
      // a still background is drawn once and reused
      if (!bgCache) {
        bgCache = document.createElement('canvas');
        bgCache.width = W; bgCache.height = H;
        render(bgCache.getContext('2d', { alpha: false }), W, H, 0, params);
        ctx.drawImage(bgCache, 0, 0);
        overlays(t);
      } else if (overlaysMove()) {
        ctx.drawImage(bgCache, 0, 0);
        overlays(t);
      }
    } else {
      render(ctx, W, H, t, params);
      overlays(t);
    }
    requestAnimationFrame(frame);
  }

  EventText.ready(S.text).then(() => { bgCache = null; });
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- browser use
  const hint = document.getElementById('hint');
  setTimeout(() => hint.classList.add('gone'), 4000);
  document.addEventListener('click', () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });
})();
