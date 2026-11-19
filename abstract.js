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
  };

  function size() {
    return state.cabOn
      ? { W: state.cabCols * state.cabW, H: state.cabRows * state.cabH }
      : { W: state.w, H: state.h };
  }

  function params() {
    return { style: state.style, palette: state.palette, seed: state.seed, density: state.density, grain: state.grain, speed: state.speed };
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
  }

  // ---------------------------------------------------------------- form <-> state
  function stateToForm() {
    ['w', 'h', 'cabCols', 'cabRows', 'cabW', 'cabH', 'density', 'speed'].forEach(k => { $(k).value = state[k]; });
    $('cabOn').checked = state.cabOn;
    $('grain').checked = state.grain;
    $('secs').value = String(state.secs);
    $('fps').value = String(state.fps);
    document.querySelectorAll('#colors input').forEach(inp => { inp.value = state.palette[Number(inp.dataset.i)]; });
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
    render(ctx, previewW, previewH, currentT(), params());
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

  $('dlPng').addEventListener('click', () => {
    const { W, H } = size();
    if (validate(W, H)) return;
    status('بيتجهز…');
    const t = currentT();
    // let the status paint before the (possibly slow) full-res render
    setTimeout(() => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      render(c.getContext('2d', { alpha: false }), W, H, t, params());
      c.toBlob(blob => {
        if (!blob) { status('المتصفح مقدرش يعمل الصورة دي — غالباً الرزلوشن كبير على الجهاز ده.', true); return; }
        deliver(blob, `abstract_${state.style}_${W}x${H}.png`);
      }, 'image/png');
    }, 30);
  });

  $('dlMp4').addEventListener('click', async () => {
    const { W, H } = size();
    if (validate(W, H) || exporting) return;
    const { VW, VH } = videoSize(W, H);
    const p = params();
    exporting = true;
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
          render(c, W, H, t, p);
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
  buildStyles();
  buildPalettes();
  if (location.hash.length > 1) fromHash(location.hash.slice(1));
  stateToForm();
  changed();
  requestAnimationFrame(loop);
})();
