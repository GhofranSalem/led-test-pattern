(function () {
  'use strict';

  // Browser canvas limits (Chrome/Edge/Firefox). Safari on iPhone/iPad is lower.
  const MAX_SIDE = 32767;
  const MAX_AREA = 268435456;      // 16384 × 16384
  const SAFARI_AREA = 16777216;    // 4096 × 4096

  const BUILTIN_PRESETS = [
    ['Full HD', 1920, 1080],
    ['4K UHD', 3840, 2160],
    ['preset.portrait', 1080, 1920],
    ['preset.wide2', 3840, 1080],
    ['preset.wide3', 5760, 1080],
    ['preset.wide4', 7680, 1080],
    ['HD', 1280, 720],
  ];
  const STORE_KEY = 'ledtp.presets';

  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');

  const numKeys = ['w', 'h', 'cabCols', 'cabRows', 'cabW', 'cabH', 'gridStep'];
  const boolKeys = ['cabOn', 'cabinets', 'grid', 'circles', 'cross', 'border', 'info'];
  const textKeys = ['solid', 'event', 'screen'];

  // ---------- state ----------
  function readState() {
    const s = {};
    numKeys.forEach(k => { s[k] = Math.floor(Number($(k).value)) || 0; });
    boolKeys.forEach(k => { s[k] = $(k).checked; });
    textKeys.forEach(k => { s[k] = $(k).value.trim(); });
    s.bg = document.querySelector('input[name="bg"]:checked').value;
    if (s.cabOn) {
      s.w = s.cabCols * s.cabW;
      s.h = s.cabRows * s.cabH;
    }
    return s;
  }

  function applyState(s) {
    numKeys.forEach(k => { if (s[k] != null) $(k).value = s[k]; });
    boolKeys.forEach(k => { if (s[k] != null) $(k).checked = !!s[k]; });
    textKeys.forEach(k => { if (s[k] != null) $(k).value = s[k]; });
    if (s.bg) {
      const r = document.querySelector(`input[name="bg"][value="${CSS.escape(s.bg)}"]`);
      if (r) r.checked = true;
    }
  }

  function validate(s) {
    if (s.w < 1 || s.h < 1) return { error: I18n.t('err.zero') };
    if (s.w > MAX_SIDE || s.h > MAX_SIDE) return { error: I18n.t('err.side', { max: MAX_SIDE }) };
    if (s.w * s.h > MAX_AREA) return { error: I18n.t('err.areaMp', { mp: (MAX_AREA / 1e6).toFixed(0) }) };
    if (s.w * s.h > SAFARI_AREA) return { warn: I18n.t('warn.safari') };
    return {};
  }

  // ---------- URL sharing ----------
  function toQuery(s) {
    const p = new URLSearchParams();
    [...numKeys, ...textKeys, 'bg'].forEach(k => { if (s[k] !== '' && s[k] != null) p.set(k, s[k]); });
    boolKeys.forEach(k => p.set(k, s[k] ? '1' : '0'));
    return p.toString();
  }

  function fromQuery(q) {
    const p = new URLSearchParams(q);
    const s = {};
    numKeys.forEach(k => { if (p.has(k)) s[k] = p.get(k); });
    textKeys.forEach(k => { if (p.has(k)) s[k] = p.get(k); });
    boolKeys.forEach(k => { if (p.has(k)) s[k] = p.get(k) === '1'; });
    if (p.has('bg')) s.bg = p.get('bg');
    return s;
  }

  // ---------- presets ----------
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
  }
  function storeSaved(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; } catch { return false; }
  }

  function fillPresets() {
    const sel = $('preset');
    sel.innerHTML = '';
    sel.add(new Option(I18n.t('res.pick'), ''));
    const g1 = document.createElement('optgroup');
    g1.label = I18n.t('tp.groupBuiltin');
    BUILTIN_PRESETS.forEach(([n, w, h]) => g1.appendChild(new Option(`${I18n.t(n)} — ${w}×${h}`, `b:${w}x${h}`)));
    sel.appendChild(g1);
    const saved = loadSaved();
    if (saved.length) {
      const g2 = document.createElement('optgroup');
      g2.label = I18n.t('tp.groupSaved');
      saved.forEach((p, i) => g2.appendChild(new Option(`${p.name} — ${p.w}×${p.h}`, `s:${i}`)));
      sel.appendChild(g2);
    }
  }

  $('preset').addEventListener('change', e => {
    const v = e.target.value;
    $('deletePreset').hidden = !v.startsWith('s:');
    if (!v) return;
    if (v.startsWith('b:')) {
      const [w, h] = v.slice(2).split('x').map(Number);
      applyState({ w, h, cabOn: false });
    } else {
      const p = loadSaved()[Number(v.slice(2))];
      if (p) applyState(p.state || { w: p.w, h: p.h, cabOn: false });
    }
    update();
  });

  $('savePreset').addEventListener('click', () => {
    const s = readState();
    const name = $('presetName').value.trim() || s.screen || `${s.w}×${s.h}`;
    $('presetName').value = '';
    const list = loadSaved();
    list.push({ name, w: s.w, h: s.h, state: s });
    if (!storeSaved(list)) { status(I18n.t('tp.storeFail'), true); return; }
    fillPresets();
    $('preset').value = `s:${list.length - 1}`;
    $('deletePreset').hidden = false;
    status(I18n.t('tp.presetSaved'));
  });

  $('deletePreset').addEventListener('click', () => {
    const v = $('preset').value;
    if (!v.startsWith('s:')) return;
    const list = loadSaved();
    list.splice(Number(v.slice(2)), 1);
    storeSaved(list);
    fillPresets();
    $('deletePreset').hidden = true;
  });

  // ---------- render ----------
  let timer = null;
  let current = null;

  function status(msg, isErr) {
    const el = $('status');
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function update() {
    const s = readState();
    $('cabFields').classList.toggle('off', !s.cabOn);
    $('w').disabled = $('h').disabled = s.cabOn;
    if (s.cabOn) { $('w').value = s.w; $('h').value = s.h; }
    $('solidWrap').hidden = s.bg !== 'solid';

    const v = validate(s);
    $('warn').hidden = !(v.error || v.warn);
    $('warn').textContent = v.error || v.warn || '';
    $('warn').classList.toggle('err', !!v.error);
    $('download').disabled = !!v.error;
    document.querySelectorAll('#fields button').forEach(b => { b.disabled = !!v.error; });

    $('meta').textContent = s.w > 0 && s.h > 0
      ? `${TestPattern.aspect(s.w, s.h)}  ·  ${(s.w * s.h / 1e6).toFixed(2)} MP`
      : '';

    try { history.replaceState(null, '', '#' + toQuery(s)); } catch { /* file:// in some browsers */ }
    // carry the resolution over to the other page
    $('otherTab').href = 'abstract.html#' + new URLSearchParams(s.cabOn
      ? { cabOn: 1, cabCols: s.cabCols, cabRows: s.cabRows, cabW: s.cabW, cabH: s.cabH }
      : { w: s.w, h: s.h, cabOn: 0 }).toString();

    if (v.error) return;
    clearTimeout(timer);
    timer = setTimeout(() => render(s), s.w * s.h > 8e6 ? 250 : 60);
  }

  function render(s) {
    if (canvas.width !== s.w) canvas.width = s.w;
    if (canvas.height !== s.h) canvas.height = s.h;
    TestPattern.draw(ctx, s.w, s.h, s);
    current = s;
  }

  // ---------- export ----------
  function slug(t) {
    // ASCII only: some browsers drop the whole filename if it has Arabic letters.
    return t.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  function saveCanvas(cv, name) {
    status(I18n.t('st.preparing'));
    cv.toBlob(blob => {
      if (!blob) {
        status(I18n.t('st.tooBig'), true);
        return;
      }
      window.saveFile(blob, name).then(r => {
        if (r === 'saved') status(I18n.t('st.saved', { name, mb: (blob.size / 1048576).toFixed(1) }));
        else if (r === 'declined') status(I18n.t('st.declined'));
        else status(I18n.t('st.saveFailed'), true);
      });
    }, 'image/png');
  }

  $('download').addEventListener('click', () => {
    clearTimeout(timer);
    const s = readState();
    if (validate(s).error) return;
    render(s); // make sure the canvas matches the form exactly
    const parts = ['testpattern', `${s.w}x${s.h}`];
    if (s.event) parts.push(slug(s.event));
    if (s.screen) parts.push(slug(s.screen));
    saveCanvas(canvas, parts.filter(Boolean).join('_') + '.png');
  });

  const COLOR_NAMES = { '#ff0000': 'red', '#00ff00': 'green', '#0000ff': 'blue', '#ffffff': 'white', '#000000': 'black' };
  $('fields').addEventListener('click', e => {
    const b = e.target.closest('button[data-color]');
    if (!b) return;
    const s = readState();
    if (validate(s).error) return;
    const cv = document.createElement('canvas');
    cv.width = s.w; cv.height = s.h;
    const c = cv.getContext('2d');
    c.fillStyle = b.dataset.color;
    c.fillRect(0, 0, s.w, s.h);
    saveCanvas(cv, `fullfield_${COLOR_NAMES[b.dataset.color]}_${s.w}x${s.h}.png`);
  });

  $('copyLink').addEventListener('click', async () => {
    const url = location.href.split('#')[0] + '#' + toQuery(readState());
    try {
      await navigator.clipboard.writeText(url);
      status(I18n.t('tp.linkCopied'));
    } catch {
      status(I18n.t('tp.copyThis', { url }));
    }
  });

  // ---------- wiring ----------
  document.getElementById('controls').addEventListener('input', e => {
    if (e.target.id === 'preset' || e.target.id === 'presetName') return;
    if (e.target.id === 'w' || e.target.id === 'h') { $('preset').value = ''; $('deletePreset').hidden = true; }
    update();
  });

  I18n.apply();
  I18n.onChange(() => {
    const keep = $('preset').value;
    fillPresets();
    $('preset').value = keep;
    status('');
    update();
  });
  fillPresets();
  if (location.hash.length > 1) applyState(fromQuery(location.hash.slice(1)));
  update();
})();
