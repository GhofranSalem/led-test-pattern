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

  const DEFAULT_PANEL = 'p2.6'; // matches the 192 px cabinet fields in the HTML

  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');

  const numKeys = ['w', 'h', 'cabCols', 'cabRows', 'cabW', 'cabH', 'gridStep', 'portPx'];
  const decKeys = ['cabKg', 'cabWatt'];
  const boolKeys = ['cabOn', 'cabinets', 'grid', 'circles', 'cross', 'border', 'info'];
  const textKeys = ['solid', 'event', 'screen', 'panel', 'ports'];
  const allKeys = [...numKeys, ...decKeys, ...boolKeys, ...textKeys, 'bg'];

  // ---------- state ----------
  function readState() {
    const s = {};
    numKeys.forEach(k => { s[k] = Math.floor(Number($(k).value)) || 0; });
    decKeys.forEach(k => { s[k] = Math.max(0, parseFloat($(k).value) || 0); });
    boolKeys.forEach(k => { s[k] = $(k).checked; });
    textKeys.forEach(k => { s[k] = $(k).value.trim(); });
    s.bg = document.querySelector('input[name="bg"]:checked').value;
    if (s.cabOn) {
      s.w = s.cabCols * s.cabW;
      s.h = s.cabRows * s.cabH;
    }
    const t = s.cabOn && Cabinets.byId(s.panel);
    if (t) s.panelInfo = `${t.name} · ${t.mmW}×${t.mmH} mm  ·  ${(s.cabCols * t.mmW / 1000).toFixed(2)} × ${(s.cabRows * t.mmH / 1000).toFixed(2)} m`;
    s.portChains = s.cabOn && s.cabW > 0 && s.cabH > 0 && s.portPx > 0 && s.cabCols > 0 && s.cabRows > 0
      ? Cabinets.portChains(s.cabCols, s.cabRows, s.cabW, s.cabH, s.ports, s.portPx) : undefined;
    return s;
  }

  function applyState(s) {
    [...numKeys, ...decKeys, ...textKeys].forEach(k => { if (s[k] != null) $(k).value = s[k]; });
    boolKeys.forEach(k => { if (s[k] != null) $(k).checked = !!s[k]; });
    if (!['off', 'rows', 'cols'].includes($('ports').value)) $('ports').value = 'off';
    if (s.bg) {
      const r = document.querySelector(`input[name="bg"][value="${CSS.escape(s.bg)}"]`);
      if (r) r.checked = true;
    }
  }

  // A link or saved preset: it may predate cabinet types, weight and power.
  function applyExternal(x) {
    applyState(x);
    cab.sync();
    if (x.cabKg == null) {
      const t = cab.current();
      $('cabKg').value = t ? t.kg : '';
      $('cabWatt').value = t ? t.watt : '';
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
    [...numKeys, ...decKeys, ...textKeys, 'bg'].forEach(k => { if (s[k] !== '' && s[k] != null) p.set(k, s[k]); });
    boolKeys.forEach(k => p.set(k, s[k] ? '1' : '0'));
    return p.toString();
  }

  function fromQuery(q) {
    const p = new URLSearchParams(q);
    const s = {};
    [...numKeys, ...decKeys].forEach(k => { if (p.has(k)) s[k] = p.get(k); });
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
    cab.resetAsked();
    if (v.startsWith('b:')) {
      const [w, h] = v.slice(2).split('x').map(Number);
      applyState({ w, h, cabOn: false });
    } else {
      const p = loadSaved()[Number(v.slice(2))];
      if (p) applyExternal(p.state || { w: p.w, h: p.h, cabOn: false, panel: '' });
    }
    update();
  });

  $('savePreset').addEventListener('click', () => {
    const s = readState();
    const name = $('presetName').value.trim() || s.screen || `${s.w}×${s.h}`;
    $('presetName').value = '';
    const list = loadSaved();
    const keep = {};
    allKeys.forEach(k => { keep[k] = s[k]; });
    list.push({ name, w: s.w, h: s.h, state: keep });
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
    cab.render(s, { error: v.error, ports: s.portChains === undefined ? undefined : s.portChains && s.portChains.length });

    try { history.replaceState(null, '', '#' + toQuery(s)); } catch { /* file:// in some browsers */ }
    // carry the resolution over to the other page
    $('otherTab').href = 'abstract.html#' + new URLSearchParams(s.cabOn
      ? { cabOn: 1, cabCols: s.cabCols, cabRows: s.cabRows, cabW: s.cabW, cabH: s.cabH, panel: s.panel, cabKg: s.cabKg, cabWatt: s.cabWatt }
      : { w: s.w, h: s.h, cabOn: 0 }).toString();

    queueSave();
    if (v.error) return;
    clearTimeout(timer);
    timer = setTimeout(() => render(s), s.w * s.h > 8e6 ? 250 : 60);
  }

  function render(s) {
    if (canvas.width !== s.w) canvas.width = s.w;
    if (canvas.height !== s.h) canvas.height = s.h;
    TestPattern.draw(ctx, s.w, s.h, s);
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
    const parts = ['testpattern', Cabinets.fileTag(Cabinets.byId(s.panel), s), `${s.w}x${s.h}`];
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
    const tag = Cabinets.fileTag(Cabinets.byId(s.panel), s);
    saveCanvas(cv, ['fullfield', COLOR_NAMES[b.dataset.color], tag, `${s.w}x${s.h}`].filter(Boolean).join('_') + '.png');
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
    if (e.target.id === 'preset' || e.target.id === 'presetName' || e.target.closest('#cabForm') || e.target.closest('#project')) return;
    if (['w', 'h', 'panel', 'scrW', 'scrH', 'cabCols', 'cabRows', 'cabW', 'cabH'].includes(e.target.id)) { $('preset').value = ''; $('deletePreset').hidden = true; }
    update();
  });

  // ---------- project: several named screens ----------
  /* The form always edits the selected screen: every change is written back to it
     (debounced). Without a project the page works exactly as before. */
  let project = Project.load();
  let saveTimer = null;

  function pjStatus(msg, isErr) {
    const el = $('pjMsg');
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }
  function snapshot() {
    const s = readState();
    const keep = {};
    allKeys.forEach(k => { keep[k] = s[k]; });
    return keep;
  }
  function typeSnap(st) {
    const t = st.cabOn && Cabinets.byId(st.panel);
    return t && t.pxW === st.cabW && t.pxH === st.cabH
      ? { name: t.name, mmW: t.mmW, mmH: t.mmH, pxW: t.pxW, pxH: t.pxH } : null;
  }
  const selected = () => (project ? project.screens.find(x => x.id === project.sel) : null);

  // Read the stored project again before each write, so changes made on the report page
  // (open in another tab) are kept.
  function commit(fn) {
    const p = Project.load() || project;
    if (!p) return false;
    if (project) p.sel = project.sel;
    fn(p);
    project = p;
    if (!Project.save(p)) { pjStatus(I18n.t('tp.storeFail'), true); return false; }
    return true;
  }
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!selected()) return;
    const st = snapshot();
    commit(p => {
      const sc = p.screens.find(x => x.id === p.sel);
      if (sc) { sc.state = st; sc.type = typeSnap(st); }
    });
    renderList();
  }
  function queueSave() {
    if (!selected()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 250);
  }

  function screenRes(sc) {
    const st = sc.state || {};
    const on = !(st.cabOn === false);
    const w = on ? st.cabCols * st.cabW : st.w, h = on ? st.cabRows * st.cabH : st.h;
    return `${w}×${h}`;
  }

  function renderList() {
    const on = !!project;
    $('pjNone').hidden = on;
    $('pjOn').hidden = !on;
    if (!on) return;
    if (document.activeElement !== $('pjName')) $('pjName').value = project.name;
    const list = $('pjList');
    list.innerHTML = '';
    project.screens.forEach((sc, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pj-item';
      b.dataset.id = sc.id;
      b.setAttribute('aria-pressed', String(sc.id === project.sel));
      const n = document.createElement('span'); n.className = 'pj-n'; n.textContent = String(i + 1);
      const nm = document.createElement('span'); nm.className = 'pj-nm'; nm.textContent = sc.name || I18n.t('pj.screenN', { n: i + 1 });
      const r = document.createElement('span'); r.className = 'pj-res'; r.textContent = screenRes(sc);
      b.append(n, nm, r);
      list.appendChild(b);
    });
    if (!project.screens.length) {
      const p = document.createElement('p');
      p.className = 'note pj-empty';
      p.textContent = I18n.t('pj.empty');
      list.appendChild(p);
    }
    $('pjCount').textContent = I18n.t('pj.count', { n: project.screens.length });
    const sc = selected();
    const idx = sc ? project.screens.indexOf(sc) : -1;
    $('pjScreen').disabled = $('pjDup').disabled = $('pjDel').disabled = !sc;
    $('pjUp').disabled = idx < 1;
    $('pjDown').disabled = idx < 0 || idx >= project.screens.length - 1;
    if (document.activeElement !== $('pjScreen')) $('pjScreen').value = sc ? sc.name : '';
  }

  function openScreen(sc) {
    if (!sc) return;
    applyExternal(sc.state);
    cab.resetAsked();
    $('preset').value = '';
    $('deletePreset').hidden = true;
    update();
  }

  function startProject() {
    const s = readState();
    const p = Project.create(s.event || I18n.t('pj.untitled'));
    const sc = Project.newScreen(s.screen || I18n.t('pj.screenN', { n: 1 }), snapshot(), typeSnap(s));
    p.screens.push(sc);
    p.sel = sc.id;
    project = p;
    if (!Project.save(p)) { pjStatus(I18n.t('tp.storeFail'), true); return false; }
    renderList();
    return true;
  }

  $('pjStart').addEventListener('click', () => {
    if (startProject()) { pjStatus(I18n.t('pj.started')); $('pjName').focus(); }
  });

  $('pjName').addEventListener('input', () => {
    commit(p => { p.name = $('pjName').value.slice(0, 120); });
  });
  $('pjScreen').addEventListener('input', () => {
    commit(p => {
      const sc = p.screens.find(x => x.id === p.sel);
      if (sc) sc.name = $('pjScreen').value.slice(0, 80);
    });
    renderList();
  });

  $('pjList').addEventListener('click', e => {
    const b = e.target.closest('.pj-item');
    if (!b || b.dataset.id === project.sel) return;
    flush();
    project.sel = b.dataset.id;
    commit(() => {});
    renderList();
    openScreen(selected());
    pjStatus('');
  });

  $('pjAdd').addEventListener('click', () => {
    flush();
    // a new screen starts from the page defaults, with the current cabinet type and data settings
    const cur = snapshot();
    const st = { ...DEFAULT_STATE };
    ['cabOn', 'panel', 'cabW', 'cabH', 'cabKg', 'cabWatt', 'portPx', 'ports', 'event'].forEach(k => { st[k] = cur[k]; });
    st.screen = '';
    const sc = Project.newScreen(I18n.t('pj.screenN', { n: project.screens.length + 1 }), st, typeSnap(st));
    commit(p => { p.screens.push(sc); p.sel = sc.id; });
    renderList();
    openScreen(sc);
    $('pjScreen').focus();
    $('pjScreen').select();
  });

  $('pjDup').addEventListener('click', () => {
    flush();
    const cur = selected();
    if (!cur) return;
    const sc = Project.newScreen(I18n.t('pj.copyOf', { name: cur.name || '' }).slice(0, 80), snapshot(), cur.type);
    commit(p => {
      const i = p.screens.findIndex(x => x.id === cur.id);
      p.screens.splice(i + 1, 0, sc);
      p.sel = sc.id;
    });
    renderList();
    $('pjScreen').focus();
    $('pjScreen').select();
  });

  $('pjDel').addEventListener('click', () => {
    const cur = selected();
    if (!cur) return;
    if (!confirm(I18n.t('pj.delQ', { name: cur.name || I18n.t('pj.screenN', { n: project.screens.indexOf(cur) + 1 }) }))) return;
    clearTimeout(saveTimer);
    let next = null;
    commit(p => {
      const i = p.screens.findIndex(x => x.id === cur.id);
      p.screens.splice(i, 1);
      next = p.screens[Math.min(i, p.screens.length - 1)] || null;
      p.sel = next ? next.id : null;
    });
    renderList();
    if (next) openScreen(next);
  });

  function move(d) {
    flush();
    commit(p => {
      const i = p.screens.findIndex(x => x.id === p.sel);
      const j = i + d;
      if (i < 0 || j < 0 || j >= p.screens.length) return;
      [p.screens[i], p.screens[j]] = [p.screens[j], p.screens[i]];
    });
    renderList();
  }
  $('pjUp').addEventListener('click', () => move(-1));
  $('pjDown').addEventListener('click', () => move(1));

  $('pjExport').addEventListener('click', () => {
    flush();
    const name = `${Project.slug(project.name) || 'project'}_LED_project_${Project.today()}.json`;
    const blob = new Blob([Project.toFile(project, Project.loadCompany())], { type: 'application/json' });
    window.saveFile(blob, name).then(r => {
      if (r === 'saved') pjStatus(I18n.t('pj.exported', { name }));
      else if (r === 'declined') pjStatus(I18n.t('st.declined'));
      else pjStatus(I18n.t('st.saveFailed'), true);
    });
  });

  document.querySelectorAll('[data-pj-import]').forEach(b => b.addEventListener('click', () => $('pjFile').click()));
  $('pjFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let r = null;
    try { r = Project.fromFile(await f.text()); } catch { r = null; }
    if (!r) { pjStatus(I18n.t('pj.badFile'), true); return; }
    if (project && !confirm(I18n.t('pj.replaceQ', { name: project.name || I18n.t('pj.untitled') }))) return;
    clearTimeout(saveTimer);
    project = r.project;
    if (!Project.save(project)) { pjStatus(I18n.t('tp.storeFail'), true); return; }
    let msg = I18n.t('pj.imported', { n: project.screens.length });
    if (r.company && Project.companyEmpty(Project.loadCompany())) {
      Project.saveCompany(r.company);
      msg += ' ' + I18n.t('pj.importedCo');
    }
    renderList();
    if (selected()) openScreen(selected());
    pjStatus(msg);
  });

  $('pjClose').addEventListener('click', () => {
    if (!confirm(I18n.t('pj.closeQ', { name: project.name || I18n.t('pj.untitled') }))) return;
    clearTimeout(saveTimer);
    Project.remove();
    project = null;
    renderList();
    pjStatus(I18n.t('pj.closed'));
  });

  $('pjReport').addEventListener('click', () => {
    if (project) flush();
    else if (!startProject()) return;
    location.href = 'report.html';
  });

  // another tab (the report page) changed the project
  window.addEventListener('storage', e => {
    if (e.key !== Project.KEY) return;
    const p = Project.load();
    const was = project && project.sel;
    if (p && was && p.screens.some(x => x.id === was)) { p.sel = was; project = p; renderList(); return; }
    // the selected screen is gone: never write this form into another screen
    clearTimeout(saveTimer);
    project = p;
    renderList();
    if (selected()) openScreen(selected());
  });
  window.addEventListener('pagehide', () => { if (saveTimer) flush(); });

  const cab = Cabinets.bind({ onChange: () => update() });

  I18n.apply();
  I18n.onChange(() => {
    const keep = $('preset').value;
    fillPresets();
    cab.fill();
    $('preset').value = keep;
    status('');
    pjStatus('');
    renderList();
    update();
  });
  fillPresets();
  cab.fill();
  $('panel').value = DEFAULT_PANEL;
  const DEFAULT_STATE = snapshot();
  const hash = location.hash.length > 1 ? location.hash.slice(1) : '';
  if (selected()) {
    // reopen the selected screen; a link with other settings becomes a new screen
    // instead of overwriting it
    applyExternal(selected().state);
    if (hash) {
      const before = toQuery(readState());
      applyExternal(fromQuery(hash));
      const s = readState();
      if (toQuery(s) !== before) {
        const sc = Project.newScreen(s.screen || I18n.t('pj.linked'), snapshot(), typeSnap(s));
        commit(p => { p.screens.push(sc); p.sel = sc.id; });
        pjStatus(I18n.t('pj.linkAdded'));
      }
    }
  } else if (hash) applyExternal(fromQuery(hash));
  renderList();
  update();
})();
