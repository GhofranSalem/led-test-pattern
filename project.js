/* Project = a name and a list of named screens, plus the report settings.
   Shared by the test-pattern page (edits the screens) and the report page (reads
   everything, edits the report settings). Needs cabinets.js.

   localStorage
     ledsc.project  the current project (one per browser; move it with Export / Import)
       { v: 1, name, client, date, sel,
         screens: [{ id, name, state, type }],   state = the test-pattern form state (same keys as a
                                                 saved preset), type = snapshot of the cabinet type
         elec: { volts, breaker, usable, avgPct, pf },
         spare,                                  spare cabinets / cables, %
         media: { server, codec, quality, alpha, fps, audio, rate, depth, naming, notes },
         report: { data, power, packing, media } }
     ledsc.company  { name, address, phone, email, footer, logo }   logo = data: URL */
(function (global) {
  'use strict';

  const KEY = 'ledsc.project';
  const CO_KEY = 'ledsc.company';
  const FILE_TYPE = 'ledsc-project';

  const ELEC = { volts: 230, breaker: 16, usable: 80, avgPct: 35, pf: 0.95 };
  const MEDIA = {
    server: 'Resolume Arena', codec: 'DXV3', quality: 'high', alpha: false, fps: '30',
    audio: 'wav', rate: '48', depth: '24', naming: '{project}_{screen}_{w}x{h}_v01', notes: '',
  };
  const REPORT = { data: true, power: true, packing: true, media: true };

  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };

  function normalise(p) {
    if (!p || typeof p !== 'object') return null;
    const o = {
      v: 1,
      name: String(p.name || '').slice(0, 120),
      client: String(p.client || '').slice(0, 120),
      date: /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : '',
      screens: (Array.isArray(p.screens) ? p.screens : []).filter(s => s && typeof s.state === 'object').map(s => ({
        id: String(s.id || uid()),
        name: String(s.name || '').slice(0, 80),
        state: s.state,
        type: s.type && s.type.mmW > 0 && s.type.pxW > 0 ? s.type : null,
      })),
      elec: { ...ELEC },
      spare: num(p.spare, 5, 0, 100),
      media: { ...MEDIA, ...(p.media && typeof p.media === 'object' ? p.media : {}) },
      report: { ...REPORT, ...(p.report && typeof p.report === 'object' ? p.report : {}) },
    };
    const e = p.elec || {};
    o.elec.volts = num(e.volts, ELEC.volts, 1, 100000);
    o.elec.breaker = num(e.breaker, ELEC.breaker, 0.1, 10000);
    o.elec.usable = num(e.usable, ELEC.usable, 1, 100);
    o.elec.avgPct = num(e.avgPct, ELEC.avgPct, 0, 100);
    o.elec.pf = num(e.pf, ELEC.pf, 0.1, 1);
    o.media.alpha = !!o.media.alpha;
    Object.keys(o.report).forEach(k => { o.report[k] = !!o.report[k]; });
    o.sel = o.screens.some(s => s.id === p.sel) ? p.sel : (o.screens[0] || {}).id || null;
    return o;
  }

  function load() {
    try { return normalise(JSON.parse(localStorage.getItem(KEY))); } catch { return null; }
  }
  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch { return false; }
  }
  function remove() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

  function create(name) { return normalise({ name: name || '', screens: [] }); }
  function newScreen(name, state, type) { return { id: uid(), name: name || '', state: { ...state }, type: type || null }; }

  const CO_FIELDS = ['name', 'address', 'phone', 'email', 'footer', 'logo'];
  function loadCompany() {
    const o = {};
    let c = null;
    try { c = JSON.parse(localStorage.getItem(CO_KEY)); } catch { /* ignore */ }
    CO_FIELDS.forEach(k => { o[k] = c && typeof c[k] === 'string' ? c[k] : ''; });
    if (o.logo && !/^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/.test(o.logo)) o.logo = '';
    return o;
  }
  function saveCompany(c) {
    try { localStorage.setItem(CO_KEY, JSON.stringify(c)); return true; } catch { return false; }
  }
  const companyEmpty = c => CO_FIELDS.every(k => !c[k]);

  // ---------- file export / import ----------
  function toFile(p, company) {
    return JSON.stringify({ type: FILE_TYPE, v: 1, project: p, company: companyEmpty(company) ? null : company }, null, 1);
  }
  /** @returns {{project, company}|null} */
  function fromFile(text) {
    let j;
    try { j = JSON.parse(text); } catch { return null; }
    if (!j || j.type !== FILE_TYPE || !j.project) return null;
    const project = normalise(j.project);
    if (!project) return null;
    let company = null;
    if (j.company && typeof j.company === 'object') {
      company = {};
      CO_FIELDS.forEach(k => { company[k] = typeof j.company[k] === 'string' ? j.company[k] : ''; });
    }
    return { project, company };
  }

  // ASCII only, for file names and document titles
  function slug(t, max) {
    return String(t || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max || 40);
  }
  function today() {
    const d = new Date();
    const z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }

  // ---------- numbers for one screen ----------
  // Row labels A … Z, AA, AB … (like spreadsheet columns), so any number of rows works.
  function rowLabel(i) {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  }
  const cabLabel = ([c, r]) => rowLabel(r) + (c + 1);

  // Cabinets in a snake, row by row (or column by column), starting top-left.
  function snake(cols, rows, byCols) {
    const out = [];
    const lines = byCols ? cols : rows, len = byCols ? rows : cols;
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < len; i++) {
        const j = l % 2 ? len - 1 - i : i;
        out.push(byCols ? [l, j] : [j, l]);
      }
    }
    return out;
  }

  function typeOf(screen) {
    const st = screen.state || {};
    if (st.cabOn === false || st.cabOn === '0') return null;
    const t = global.Cabinets && Cabinets.byId(st.panel);
    const cw = Number(st.cabW), ch = Number(st.cabH);
    if (t && t.pxW === cw && t.pxH === ch) return t;
    const s = screen.type;
    if (s && s.pxW === cw && s.pxH === ch && s.mmW > 0 && s.mmH > 0) return s;
    return null;
  }

  /* Everything the report needs for one screen. Works without cabinets (pixels only)
     and without a cabinet type (no physical size). */
  function compute(screen, project) {
    const st = screen.state || {};
    const el = project.elec;
    const cabOn = !(st.cabOn === false || st.cabOn === '0');
    const o = { name: screen.name, cabOn };
    const int = v => Math.max(0, Math.floor(Number(v)) || 0);
    if (cabOn) {
      o.cols = int(st.cabCols); o.rows = int(st.cabRows);
      o.cabW = int(st.cabW); o.cabH = int(st.cabH);
      o.w = o.cols * o.cabW; o.h = o.rows * o.cabH;
      o.count = o.cols * o.rows;
    } else {
      o.w = int(st.w); o.h = int(st.h);
      o.count = 0;
    }
    o.pixels = o.w * o.h;
    o.valid = o.w > 0 && o.h > 0;
    const t = cabOn ? typeOf(screen) : null;
    o.type = t;
    if (t && o.count) {
      o.mmW = o.cols * t.mmW; o.mmH = o.rows * t.mmH;
      o.area = o.mmW * o.mmH / 1e6;
      o.pitch = Cabinets.pitch(t);
    }
    if (!cabOn || !o.count) return o;

    o.kgEach = Math.max(0, Number(st.cabKg) || 0);
    o.wattEach = Math.max(0, Number(st.cabWatt) || 0);
    o.kg = o.count * o.kgEach;
    o.byCols = st.ports === 'cols';

    // power
    if (o.wattEach > 0) {
      const va = el.volts * el.pf;
      o.peak = o.count * o.wattEach;
      o.avg = o.peak * el.avgPct / 100;
      o.amps = o.peak / va;
      o.circuitW = va * el.breaker * el.usable / 100;
      o.perCircuit = Math.floor(o.circuitW / o.wattEach);
      if (o.perCircuit >= 1) {
        const n = Math.ceil(o.count / o.perCircuit);
        const order = snake(o.cols, o.rows, o.byCols);
        o.circuits = [];
        let at = 0;
        for (let i = 0; i < n; i++) {
          const size = Math.floor(o.count / n) + (i < o.count % n ? 1 : 0); // balanced runs
          const cabs = order.slice(at, at + size);
          at += size;
          const w = cabs.length * o.wattEach;
          o.circuits.push({ cabs, w, a: w / va, avg: w * el.avgPct / 100, phase: 'L' + (i % 3 + 1) });
        }
      } else {
        o.circuits = null; // one cabinet is more than one circuit can carry
      }
    }

    // data
    o.portPx = int(st.portPx) || Cabinets.PORT_PX;
    if (o.cabW > 0 && o.cabH > 0) {
      const chains = Cabinets.portChains(o.cols, o.rows, o.cabW, o.cabH, o.byCols ? 'cols' : 'rows', o.portPx);
      o.ports = chains ? chains.map(cabs => {
        const px = cabs.length * o.cabW * o.cabH;
        return { cabs, px, load: px / o.portPx };
      }) : null;
    }
    o.dataLinks = o.ports ? o.ports.reduce((a, p) => a + p.cabs.length - 1, 0) : 0;
    o.powerLinks = o.circuits ? o.circuits.reduce((a, c) => a + c.cabs.length - 1, 0) : 0;
    return o;
  }

  global.Project = {
    KEY, CO_KEY, ELEC, MEDIA, REPORT,
    load, save, remove, create, newScreen, normalise,
    loadCompany, saveCompany, companyEmpty,
    toFile, fromFile, slug, today,
    rowLabel, cabLabel, snake, typeOf, compute,
  };
})(window);
