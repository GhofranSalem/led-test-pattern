(function () {
  'use strict';

  const MAX_SIDE = 32767;
  const MAX_AREA = 268435456;
  const PRESETS = [
    ['Full HD', 1920, 1080],
    ['4K UHD', 3840, 2160],
    ['Full HD عمودي', 1080, 1920],
    ['2 × Full HD عرض', 3840, 1080],
    ['3 × Full HD عرض', 5760, 1080],
    ['4 × Full HD عرض', 7680, 1080],
    ['HD', 1280, 720],
  ];

  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const { STYLES, PALETTES, render } = window.Abstract;

  // ---------------------------------------------------------------- state
  const state = {
    w: 1920, h: 1080,
    cabOn: false, cabCols: 12, cabRows: 4, cabW: 128, cabH: 128,
    style: 'blobs',
    palette: PALETTES[0].colors.slice(),
    seed: 20261119,
    density: 0.5,
    grain: true,
    speed: 1,
    secs: 30,
    fps: 30,
    logo: { size: 0.25, anchor: 'br', margin: 0.05, cx: 0.5, cy: 0.5, opacity: 1 },
    text: { title: '', sub: '', font: 'Cairo', weight: 700, color: '#ffffff', size: 0.12, anchor: 'c', margin: 0.05, cx: 0.5, cy: 0.5, shadow: true },
  };
  let logo = null; // loaded logo image (see logo.js)

  function size() {
    return state.cabOn
      ? { W: state.cabCols * state.cabW, H: state.cabRows * state.cabH }
      : { W: state.w, H: state.h };
  }

  function params() {
    return { style: state.style, palette: state.palette, seed: state.seed, density: state.density, grain: state.grain, speed: state.speed };
  }

  // background + logo: used by the preview, the PNG and every video frame
  function renderFrame(c, W, H, t, p) {
    render(c, W, H, t, p);
    Logo.draw(c, logo, state.logo, W, H);
    EventText.draw(c, state.text, W, H);
  }

  function validate(W, H) {
    if (!(W >= 1 && H >= 1)) return 'العرض والارتفاع لازم يكونوا أكبر من صفر.';
    if (W > MAX_SIDE || H > MAX_SIDE) return `أقصى طول لأي ضلع في المتصفح ${MAX_SIDE} px.`;
    if (W * H > MAX_AREA) return 'الرزلوشن أكبر من حد المتصفح.';
    return '';
  }

  // ---------------------------------------------------------------- URL
  const NUM = ['w', 'h', 'cabCols', 'cabRows', 'cabW', 'cabH', 'seed', 'density', 'speed', 'secs', 'fps'];
  const BOOL = ['cabOn', 'grain'];

  function toHash() {
    const p = new URLSearchParams();
    NUM.forEach(k => p.set(k, state[k]));
    BOOL.forEach(k => p.set(k, state[k] ? '1' : '0'));
    p.set('style', state.style);
    p.set('pal', state.palette.map(c => c.slice(1)).join('-'));
    const L = state.logo;
    p.set('logo', [L.size, L.anchor, L.margin, +L.cx.toFixed(4), +L.cy.toFixed(4), L.opacity].join('~'));
    const T = state.text;
    if (T.title) p.set('title', T.title);
    if (T.sub) p.set('sub', T.sub);
    p.set('txt', [T.font, T.weight, T.color.slice(1), T.size, T.anchor, T.margin, +T.cx.toFixed(4), +T.cy.toFixed(4), T.shadow ? 1 : 0].join('~'));
    return p.toString();
  }

  function fromHash(h) {
    const p = new URLSearchParams(h);
    NUM.forEach(k => { if (p.has(k) && isFinite(Number(p.get(k)))) state[k] = Number(p.get(k)); });
    BOOL.forEach(k => { if (p.has(k)) state[k] = p.get(k) === '1'; });
    if (p.has('style') && STYLES.some(s => s.id === p.get('style'))) state.style = p.get('style');
    if (p.has('pal')) {
      const cols = p.get('pal').split('-').filter(c => /^[0-9a-f]{6}$/i.test(c)).map(c => '#' + c.toLowerCase());
      if (cols.length === 5) state.palette = cols;
    }
    if (p.has('logo')) {
      const [size, anchor, margin, cx, cy, opacity] = p.get('logo').split('~');
      const L = state.logo, n = (v, lo, hi, d) => (isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
      L.size = n(size, 0.03, 1, L.size);
      if (/^(tl|t|tr|l|c|r|bl|b|br|custom)$/.test(anchor)) L.anchor = anchor;
      L.margin = n(margin, 0, 0.25, L.margin);
      L.cx = n(cx, 0, 1, L.cx); L.cy = n(cy, 0, 1, L.cy);
      L.opacity = n(opacity, 0.1, 1, L.opacity);
    }
    const T = state.text;
    if (p.has('title')) T.title = p.get('title').slice(0, 200);
    if (p.has('sub')) T.sub = p.get('sub').slice(0, 200);
    if (p.has('txt')) {
      const [font, weight, color, sz, anchor, margin, cx, cy, shadow] = p.get('txt').split('~');
      const n = (v, lo, hi, d) => (isFinite(+v) && v !== '' ? Math.min(hi, Math.max(lo, +v)) : d);
      if (EventText.FONTS.some(f => f.id === font)) T.font = font;
      if (['400', '700', '900'].includes(weight)) T.weight = Number(weight);
      if (/^[0-9a-f]{6}$/i.test(color)) T.color = '#' + color.toLowerCase();
      T.size = n(sz, 0.02, 0.6, T.size);
      if (/^(tl|t|tr|l|c|r|bl|b|br|custom)$/.test(anchor)) T.anchor = anchor;
      T.margin = n(margin, 0, 0.25, T.margin);
      T.cx = n(cx, 0, 1, T.cx); T.cy = n(cy, 0, 1, T.cy);
      T.shadow = shadow !== '0';
    }
  }

  // ---------------------------------------------------------------- form <-> state
  function stateToForm() {
    ['w', 'h', 'cabCols', 'cabRows', 'cabW', 'cabH', 'density', 'speed'].forEach(k => { $(k).value = state[k]; });
    $('cabOn').checked = state.cabOn;
    $('grain').checked = state.grain;
    $('secs').value = String(state.secs);
    $('fps').value = String(state.fps);
    document.querySelectorAll('#colors input').forEach(inp => { inp.value = state.palette[Number(inp.dataset.i)]; });
    $('logoSize').value = state.logo.size;
    $('logoMargin').value = state.logo.margin;
    $('logoOpacity').value = state.logo.opacity;
    const T = state.text;
    $('textTitle').value = T.title;
    $('textSub').value = T.sub;
    $('textFont').value = T.font;
    $('textWeight').value = String(T.weight);
    $('textColor').value = T.color;
    $('textSize').value = T.size;
    $('textMargin').value = T.margin;
    $('textShadow').checked = T.shadow;
  }

  function formToState() {
    ['w', 'h', 'cabCols', 'cabRows', 'cabW', 'cabH', 'secs', 'fps', 'speed'].forEach(k => { state[k] = Math.floor(Number($(k).value)) || 0; });
    state.density = Number($('density').value);
    state.cabOn = $('cabOn').checked;
    state.grain = $('grain').checked;
  }

  // ---------------------------------------------------------------- UI builders
  function fillPresets() {
    const sel = $('preset');
    sel.add(new Option('— اختار —', ''));
    PRESETS.forEach(([n, w, h]) => sel.add(new Option(`${n} — ${w}×${h}`, `${w}x${h}`)));
  }

  const thumbs = [];
  function buildStyles() {
    const box = $('styles');
    STYLES.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'style-btn';
      b.dataset.style = s.id;
      b.setAttribute('aria-pressed', 'false');
      const c = document.createElement('canvas');
      c.width = 160; c.height = 90;
      const label = document.createElement('span');
      label.textContent = s.name;
      b.append(c, label);
      box.appendChild(b);
      thumbs.push({ id: s.id, canvas: c, btn: b });
    });
    box.addEventListener('click', e => {
      const b = e.target.closest('.style-btn');
      if (!b) return;
      state.style = b.dataset.style;
      changed();
    });
  }

  function drawThumbs() {
    thumbs.forEach(t => {
      const c = t.canvas.getContext('2d');
      render(c, t.canvas.width, t.canvas.height, 0, { ...params(), style: t.id, grain: false });
      t.btn.setAttribute('aria-pressed', String(t.id === state.style));
    });
  }

  function buildPalettes() {
    const box = $('palettes');
    PALETTES.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pal-btn';
      b.title = p.name;
      b.dataset.id = p.id;
      b.style.background = `linear-gradient(90deg, ${p.colors.slice(1).join(',')})`;
      b.style.borderColor = p.colors[0];
      const label = document.createElement('span');
      label.textContent = p.name;
      b.appendChild(label);
      box.appendChild(b);
    });
    box.addEventListener('click', e => {
      const b = e.target.closest('.pal-btn');
      if (!b) return;
      state.palette = PALETTES.find(p => p.id === b.dataset.id).colors.slice();
      stateToForm();
      changed();
    });
  }

  function markPalette() {
    const key = state.palette.join();
    document.querySelectorAll('.pal-btn').forEach(b => {
      const p = PALETTES.find(x => x.id === b.dataset.id);
      b.setAttribute('aria-pressed', String(p.colors.join() === key));
    });
  }

  // ---------------------------------------------------------------- preview
  let playing = true;
  let t0 = performance.now();
  let tPaused = 0;
  let previewW = 0, previewH = 0;

  function currentT() {
    if (!playing) return tPaused;
    return (((performance.now() - t0) / 1000) / state.secs) % 1;
  }

  function sizePreview() {
    const { W, H } = size();
    if (validate(W, H)) return;
    const wrap = $('wrap');
    const maxW = Math.max(100, wrap.clientWidth - 32);
    const maxH = Math.max(100, window.innerWidth <= 820 ? window.innerHeight * 0.45 : Math.min(window.innerHeight - 190, 900));
    const scale = Math.min(maxW / W, maxH / H, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(1, Math.round(W * scale)), cssH = Math.max(1, Math.round(H * scale));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    previewW = Math.max(1, Math.round(cssW * dpr));
    previewH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== previewW) canvas.width = previewW;
    if (canvas.height !== previewH) canvas.height = previewH;
  }

  function drawPreview() {
    if (!previewW) return;
    renderFrame(ctx, previewW, previewH, currentT(), params());
  }

  function loop() {
    if (playing && !exporting) drawPreview();
    requestAnimationFrame(loop);
  }

  $('play').addEventListener('click', () => {
    if (playing) { tPaused = currentT(); playing = false; }
    else { t0 = performance.now() - tPaused * state.secs * 1000; playing = true; }
    $('play').textContent = playing ? '⏸ إيقاف الحركة' : '▶ تشغيل الحركة';
    drawPreview();
  });

  // ---------------------------------------------------------------- update
  function videoSize(W, H) { return { VW: W + (W % 2), VH: H + (H % 2) }; }

  function changed() {
    const { W, H } = size();
    $('cabFields').hidden = !state.cabOn;
    $('w').disabled = $('h').disabled = state.cabOn;
    if (state.cabOn) { $('w').value = W; $('h').value = H; }

    const err = validate(W, H);
    $('warn').hidden = !err;
    $('warn').textContent = err;
    $('warn').classList.toggle('err', !!err);
    $('dlPng').disabled = !!err || exporting;
    $('dlMp4').disabled = !!err || exporting || !VideoExport.supported();

    const g = gcd(W, H);
    $('meta').textContent = err ? '' : `${W} × ${H}  ·  ${W / g}:${H / g}  ·  ${(W * H / 1e6).toFixed(2)} MP`;

    const { VW, VH } = videoSize(W, H);
    const mb = (Math.min(120e6, Math.max(8e6, VW * VH * state.fps * 0.12)) * state.secs) / 8 / 1048576;
    let info = VideoExport.supported()
      ? `الفيديو: ${VW}×${VH} · ${state.secs} ثانية · ${state.fps}fps · حوالي ${Math.round(mb)} MB`
      : 'تحميل الفيديو محتاج Chrome أو Edge على الكمبيوتر.';
    if (VideoExport.supported() && (VW !== W || VH !== H)) info += ` — اتزوّد بكسل أسود لأن H.264 محتاج أرقام زوجية.`;
    $('videoInfo').textContent = err ? '' : info;

    updateLogoUI(W, H, err);
    updateTextUI();
    markPalette();
    drawThumbs();
    try { history.replaceState(null, '', '#' + toHash()); } catch { /* ignore */ }
    $('otherTab').href = 'test-pattern.html#' + new URLSearchParams(state.cabOn
      ? { cabOn: 1, cabCols: state.cabCols, cabRows: state.cabRows, cabW: state.cabW, cabH: state.cabH }
      : { w: state.w, h: state.h, cabOn: 0 }).toString();

    if (!err) { sizePreview(); drawPreview(); }
  }

  function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a || 1; }

  $('controls').addEventListener('input', e => {
    const id = e.target.id;
    if (id.startsWith('logo') || id.startsWith('text')) return; // handled by their own sections
    if (e.target.closest('#colors')) {
      state.palette[Number(e.target.dataset.i)] = e.target.value;
    } else if (id === 'preset') {
      if (!e.target.value) return;
      const [w, h] = e.target.value.split('x').map(Number);
      state.w = w; state.h = h; state.cabOn = false;
      stateToForm();
    } else {
      if (id === 'w' || id === 'h') $('preset').value = '';
      formToState();
    }
    changed();
  });

  $('reseed').addEventListener('click', () => {
    state.seed = (Math.random() * 2 ** 31) | 0;
    changed();
  });

  window.addEventListener('resize', () => { sizePreview(); drawPreview(); });

  // ---------------------------------------------------------------- logo
  const fmt = n => Math.round(n).toLocaleString('en-US');
  // "1,800 × 540 px" kept left-to-right inside Arabic sentences
  const dim = (w, h) => `\u2066${fmt(w)} × ${fmt(h)} px\u2069`;

  function updateLogoUI(W, H, err) {
    const has = !!logo;
    $('logoControls').hidden = !has;
    $('logoDropText').textContent = has ? 'تغيير اللوجو (SVG أو PNG)' : 'اختار ملف SVG أو PNG، أو اسحبه هنا';
    canvas.classList.toggle('has-logo', has || !!(state.text.title || state.text.sub));
    $('logoSizeOut').textContent = Math.round(state.logo.size * 100) + '%';
    document.querySelectorAll('#logoPos button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === state.logo.anchor)));
    $('logoMargin').disabled = state.logo.anchor === 'custom' || state.logo.anchor === 'c';

    let warn = '', short = '', severe = false;
    if (has && !err) {
      const r = Logo.rect(logo, state.logo, W, H);
      $('logoPx').textContent = `هيتعرض بمقاس ${dim(r.w, r.h)}` +
        (logo.kind === 'svg' ? ' · SVG (بيفضل حاد في أي مقاس)' : ` · الأصل ${dim(logo.natW, logo.natH)}`);
      const up = Logo.upscale(logo, state.logo, W, H);
      if (up > 1.05) {
        severe = up >= 2;
        warn = `⚠ اللوجو صغير على الرزلوشن ده: الأصل ${dim(logo.natW, logo.natH)} وهيتكبّر \u2066${up.toFixed(1)}×\u2069 لـ ${dim(r.w, r.h)}، فهيبان مش حاد على الشاشة. ` +
          `محتاج نسخة ارتفاعها \u2066${fmt(Math.ceil(r.h))} px\u2069 على الأقل، أو ملف SVG، أو صغّر الحجم.`;
        short = `⚠ اللوجو هيتكبّر \u2066${up.toFixed(1)}×\u2069 ومش هيبقى حاد.`;
      } else if (logo.kind === 'svg' && logo.hasRaster) {
        warn = 'ملحوظة: ملف الـ SVG ده جواه صورة عادية (مش vector)، فالجزء ده ممكن مايبقاش حاد لو اتكبّر.';
      }
    }
    $('logoWarn').hidden = !warn;
    $('logoWarn').textContent = warn;
    $('logoWarn').classList.toggle('err', severe);
    $('logoWarnShort').hidden = !short;
    $('logoWarnShort').textContent = short;
    $('logoWarnShort').classList.toggle('err', severe);
  }

  async function useLogoFile(file) {
    if (!file) return;
    try {
      logo = await Logo.fromFile(file);
    } catch (e) {
      status(e && e.message === 'type' ? 'الملف لازم يكون صورة SVG أو PNG.' : 'مقدرتش أقرا ملف اللوجو ده.', true);
      return;
    }
    $('logoThumb').src = logo.src;
    $('logoName').textContent = logo.name;
    if (!Logo.store(logo)) status('اللوجو اشتغل، بس مش هيتحفظ للمرة الجاية (الملف كبير على تخزين المتصفح).');
    else status('');
    changed();
  }

  $('logoFile').addEventListener('change', e => {
    useLogoFile(e.target.files[0]);
    e.target.value = '';
  });
  const drop = $('logoDrop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    useLogoFile(e.dataTransfer.files[0]);
  });

  $('logoRemove').addEventListener('click', () => {
    logo = null;
    Logo.store(null);
    $('logoThumb').removeAttribute('src');
    changed();
  });

  $('logoSize').addEventListener('input', e => { state.logo.size = Number(e.target.value); changed(); });
  $('logoMargin').addEventListener('input', e => { state.logo.margin = Number(e.target.value); changed(); });
  $('logoOpacity').addEventListener('input', e => { state.logo.opacity = Number(e.target.value); changed(); });
  $('logoPos').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    state.logo.anchor = b.dataset.a;
    changed();
  });

  // drag the logo or the event name on the preview
  let drag = null;
  function toFrame(e) {
    const r = canvas.getBoundingClientRect();
    return { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
  }
  // text is drawn on top, so it wins when both overlap
  function hitAny(u, v) {
    const { W, H } = size();
    const x = u * W, y = v * H;
    const inside = r => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const t = EventText.layout(state.text, W, H);
    if (inside(t)) return { target: state.text, r: t };
    const l = logo ? Logo.rect(logo, state.logo, W, H) : null;
    if (inside(l)) return { target: state.logo, r: l };
    return null;
  }
  canvas.addEventListener('pointerdown', e => {
    const { u, v } = toFrame(e);
    const hit = hitAny(u, v);
    if (!hit) return;
    const { r, target } = hit;
    const { W, H } = size();
    drag = { target, du: u - (r.x + r.w / 2) / W, dv: v - (r.y + r.h / 2) / H, hw: r.w / 2 / W, hh: r.h / 2 / H };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('logo-drag');
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    const { u, v } = toFrame(e);
    if (!drag) { canvas.classList.toggle('logo-hover', !!hitAny(u, v)); return; }
    let cx = Math.min(1 - drag.hw, Math.max(drag.hw, u - drag.du));
    let cy = Math.min(1 - drag.hh, Math.max(drag.hh, v - drag.dv));
    if (drag.hw * 2 >= 1) cx = 0.5;
    if (drag.hh * 2 >= 1) cy = 0.5;
    if (Math.abs(cx - 0.5) < 0.012) cx = 0.5; // snap to the centre lines
    if (Math.abs(cy - 0.5) < 0.012) cy = 0.5;
    Object.assign(drag.target, { anchor: 'custom', cx, cy });
    changed();
  });
  const endDrag = () => { drag = null; canvas.classList.remove('logo-drag'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  async function restoreLogo() {
    const o = Logo.stored();
    if (!o || !o.src) return;
    try {
      logo = await Logo.fromStored(o);
      $('logoThumb').src = logo.src;
      $('logoName').textContent = logo.name;
      changed();
    } catch { Logo.store(null); }
  }

  // ---------------------------------------------------------------- event name
  function fillFonts() {
    EventText.FONTS.forEach(f => $('textFont').add(new Option(f.name, f.id)));
  }

  function updateTextUI() {
    const T = state.text;
    $('textSizeOut').textContent = Math.round(T.size * 100) + '%';
    document.querySelectorAll('#textPos button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === T.anchor)));
    $('textMargin').disabled = T.anchor === 'custom' || T.anchor === 'c';
    $('textOptions').hidden = !(T.title || T.sub);
  }

  // redraw once the web font has arrived, so the preview never sticks on a fallback font
  function textChanged() {
    changed();
    EventText.ready(state.text).then(() => { if (!exporting) changed(); });
  }

  $('textTitle').addEventListener('input', e => { state.text.title = e.target.value; textChanged(); });
  $('textSub').addEventListener('input', e => { state.text.sub = e.target.value; textChanged(); });
  $('textFont').addEventListener('input', e => { state.text.font = e.target.value; textChanged(); });
  $('textWeight').addEventListener('input', e => { state.text.weight = Number(e.target.value); textChanged(); });
  $('textColor').addEventListener('input', e => { state.text.color = e.target.value; changed(); });
  $('textSize').addEventListener('input', e => { state.text.size = Number(e.target.value); changed(); });
  $('textMargin').addEventListener('input', e => { state.text.margin = Number(e.target.value); changed(); });
  $('textShadow').addEventListener('input', e => { state.text.shadow = e.target.checked; changed(); });
  $('textPos').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    state.text.anchor = b.dataset.a;
    changed();
  });

  // ---------------------------------------------------------------- export
  let exporting = false;
  let abort = null;

  function status(msg, isErr) {
    $('status').textContent = msg || '';
    $('status').classList.toggle('err', !!isErr);
  }

  async function deliver(blob, name) {
    const r = await window.saveFile(blob, name);
    if (r === 'saved') status(`اتحمّل: ${name} (${(blob.size / 1048576).toFixed(1)} MB)`);
    else if (r === 'declined') status('التحميل اتلغى.');
    else status('مقدرتش أحفظ الملف.', true);
  }

  $('dlPng').addEventListener('click', async () => {
    const { W, H } = size();
    if (validate(W, H)) return;
    status('بيتجهز…');
    const t = currentT();
    await EventText.ready(state.text);
    // let the status paint before the (possibly slow) full-res render
    setTimeout(() => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      try {
        renderFrame(c.getContext('2d', { alpha: false }), W, H, t, params());
      } catch (e) {
        status('حصلت مشكلة في رسم الصورة: ' + e.message, true);
        return;
      }
      try {
        c.toBlob(blob => {
          if (!blob) { status('المتصفح مقدرش يعمل الصورة دي — غالباً الرزلوشن كبير على الجهاز ده.', true); return; }
          deliver(blob, `abstract_${state.style}_${W}x${H}.png`);
        }, 'image/png');
      } catch (e) {
        // a "tainted" canvas: some SVGs (e.g. with <foreignObject>) block export
        status('المتصفح رفض يحفظ الصورة بسبب ملف اللوجو. جرّب نسخة PNG من اللوجو.', true);
      }
    }, 30);
  });

  $('dlMp4').addEventListener('click', async () => {
    const { W, H } = size();
    if (validate(W, H) || exporting) return;
    const { VW, VH } = videoSize(W, H);
    const p = params();
    exporting = true;
    await EventText.ready(state.text);
    abort = new AbortController();
    changed();
    $('progress').hidden = false;
    $('bar').style.width = '0%';
    status('');
    const started = performance.now();
    try {
      const blob = await VideoExport.exportMp4({
        width: VW, height: VH, fps: state.fps, seconds: state.secs, signal: abort.signal,
        draw: (c, w, h, t) => {
          if (w !== W || h !== H) { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); }
          c.save();
          c.beginPath(); c.rect(0, 0, W, H); c.clip();
          renderFrame(c, W, H, t, p);
          c.restore();
        },
        onProgress: f => {
          $('bar').style.width = (f * 100).toFixed(1) + '%';
          const el = (performance.now() - started) / 1000;
          const left = f > 0.02 ? Math.round(el / f - el) : null;
          $('progressText').textContent = `${Math.round(f * 100)}%` + (left != null ? ` · باقي حوالي ${left} ثانية` : '');
        },
      });
      const name = `abstract_${state.style}_${VW}x${VH}_${state.secs}s_${state.fps}fps.mp4`;
      await deliver(blob, name);
    } catch (e) {
      if (e && e.name === 'AbortError') status('اتلغى.');
      else if (e && e.message === 'size') status(`الجهاز ده مش قادر يعمل فيديو H.264 بمقاس ${VW}×${VH}. جرّب جهاز تاني أو قسّم الشاشة على أكتر من فيديو.`, true);
      else if (e && e.message === 'unsupported') status('تحميل الفيديو محتاج Chrome أو Edge على الكمبيوتر.', true);
      else status('حصلت مشكلة في عمل الفيديو: ' + (e && e.message ? e.message : e), true);
    } finally {
      exporting = false;
      abort = null;
      $('progress').hidden = true;
      changed();
    }
  });

  $('cancel').addEventListener('click', () => { if (abort) abort.abort(); });

  // ---------------------------------------------------------------- init
  fillPresets();
  fillFonts();
  buildStyles();
  buildPalettes();
  if (location.hash.length > 1) fromHash(location.hash.slice(1));
  stateToForm();
  changed();
  restoreLogo();
  EventText.ready(state.text).then(() => changed());
  requestAnimationFrame(loop);
})();
