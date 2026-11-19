/* LED cabinet types and the "Calculate from cabinets" section, shared by the
   test-pattern and backgrounds pages.

   Both pages use the same element ids: cabOn, panel, cabAdd, cabDel, cabForm (ct* inputs),
   scrW, scrH, scrNote, cabCols, cabRows, cabW, cabH, cabKg, cabWatt, summary.
   The controller only reads and writes those fields; each page still reads the
   numbers from the form in its own input listener, which runs after the
   controller's (element listeners fire before the bubbling one on #controls). */
(function (global) {
  'use strict';

  const CUSTOM_KEY = 'ledsc.cabTypes';
  const PORT_PX = 655360; // one 1 Gb sending-card port at 8 bit (e.g. NovaStar)

  // Typical factory values. Weight (kg) and max power (W) are per cabinet and
  // only a starting point: check the datasheet of the actual product.
  // [id, group, name, mm W, mm H, px W, px H, kg, max W]
  const BUILTIN = [
    ['p1.9', 'panel.gIndoor', 'P1.9', 500, 500, 256, 256, 8, 200],
    ['p2.6', 'panel.gIndoor', 'P2.6', 500, 500, 192, 192, 7.5, 180],
    ['p2.9', 'panel.gIndoor', 'P2.9', 500, 500, 168, 168, 7.5, 180],
    ['p3.9', 'panel.gIndoor', 'P3.9', 500, 500, 128, 128, 7.5, 180],
    ['p4.8', 'panel.gIndoor', 'P4.8', 500, 500, 104, 104, 7.5, 160],
    ['p1.9t', 'panel.gIndoorTall', 'P1.9', 500, 1000, 256, 512, 14, 400],
    ['p2.6t', 'panel.gIndoorTall', 'P2.6', 500, 1000, 192, 384, 13, 360],
    ['p2.9t', 'panel.gIndoorTall', 'P2.9', 500, 1000, 168, 336, 13, 360],
    ['p3.9t', 'panel.gIndoorTall', 'P3.9', 500, 1000, 128, 256, 13, 360],
    ['p2.5w', 'panel.g640', 'P2.5', 640, 480, 256, 192, 9, 200],
    ['p0.9f', 'panel.gFine', 'P0.9', 600, 337.5, 640, 360, 5, 130],
    ['p1.2f', 'panel.gFine', 'P1.2', 600, 337.5, 480, 270, 4.5, 110],
    ['p1.5f', 'panel.gFine', 'P1.5', 600, 337.5, 384, 216, 4.5, 110],
    ['p1.8f', 'panel.gFine', 'P1.8', 600, 337.5, 320, 180, 4.5, 110],
    ['p4o', 'panel.gOutdoor', 'P4', 960, 960, 240, 240, 42, 750],
    ['p5o', 'panel.gOutdoor', 'P5', 960, 960, 192, 192, 40, 700],
    ['p6.67o', 'panel.gOutdoor', 'P6.67', 960, 960, 144, 144, 38, 650],
    ['p8o', 'panel.gOutdoor', 'P8', 960, 960, 120, 120, 38, 600],
    ['p10o', 'panel.gOutdoor', 'P10', 960, 960, 96, 96, 36, 550],
  ].map(([id, group, name, mmW, mmH, pxW, pxH, kg, watt]) => ({ id, group, name, mmW, mmH, pxW, pxH, kg, watt }));

  // ---------- custom types (this browser only) ----------
  function loadCustom() {
    try {
      const l = JSON.parse(localStorage.getItem(CUSTOM_KEY));
      return Array.isArray(l) ? l.filter(t => t && t.id && t.mmW > 0 && t.mmH > 0 && t.pxW > 0 && t.pxH > 0) : [];
    } catch { return []; }
  }
  function storeCustom(list) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); return true; } catch { return false; }
  }

  const all = () => [...BUILTIN, ...loadCustom().map(t => ({ ...t, group: 'panel.gMine', custom: true }))];
  const byId = id => (id ? all().find(t => t.id === id) : null);
  const pitch = t => +(t.mmW / t.pxW).toFixed(t.mmW / t.pxW < 1 ? 4 : 3);
  const fmtM = mm => String(+(mm / 1000).toFixed(2));

  // ---------- numbers ----------
  // Power supply sizing from the max power (full white, full brightness):
  // I = P / (V · PF), and the supply is sized so that load ≤ 80 % of its rating.
  const PF = 0.95;                 // LED power supplies with PFC
  // Event supplies come in CEE (IEC 60309) connector sizes up to 125 A, then larger feeds.
  const SIZES = [16, 32, 63, 125, 160, 200, 250, 400, 630, 800, 1000, 1250, 1600];
  const CEE_MAX = 125;
  const MAX_SINGLE = 63;           // above this, use three phase

  function supply(watt) {
    const i1 = watt / (230 * PF);
    const i3 = watt / (Math.sqrt(3) * 400 * PF);
    const pick = i => SIZES.find(b => i <= b * 0.8) || null;
    const b1 = pick(i1), b3 = pick(i3);
    return {
      i1, i3, b1: b1 && b1 <= MAX_SINGLE ? b1 : null, b3,
      cee3: b3 && b3 <= CEE_MAX ? b3 : null,
      kva: Math.ceil(watt / 1000 / 0.8 * 1.25), // generator: kW / 0.8 PF, plus 25 % headroom
    };
  }

  function info(t, s) {
    const n = s.cabCols * s.cabRows;
    const o = { count: n, cols: s.cabCols, rows: s.cabRows, w: s.cabCols * s.cabW, h: s.cabRows * s.cabH };
    if (t) {
      o.mmW = s.cabCols * t.mmW;
      o.mmH = s.cabRows * t.mmH;
      o.area = o.mmW * o.mmH / 1e6;
      o.diag = Math.hypot(o.mmW, o.mmH);
    }
    if (s.cabKg > 0) o.kg = n * s.cabKg;
    if (s.cabWatt > 0) { o.watt = n * s.cabWatt; o.supply = supply(o.watt); }
    return o;
  }

  // Short ASCII tag for file names, e.g. "P2.6_6x2m".
  function fileTag(t, s) {
    if (!t || !s.cabOn) return '';
    const name = t.name.replace(/[^A-Za-z0-9.]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'cabinet';
    return `${name}_${fmtM(s.cabCols * t.mmW)}x${fmtM(s.cabRows * t.mmH)}m`;
  }

  /* Sending-card port chains. Each port takes whole rows (or columns) when one
     fits; a line longer than a port is split into equal parts. Cabinets are
     chained in a snake inside each port, starting top-left.
     Returns [[ [col,row], ... ], ...] or null when one cabinet is over capacity. */
  function portChains(cols, rows, cabW, cabH, mode, portPx) {
    const cap = Math.floor(portPx / (cabW * cabH));
    if (cap < 1) return null;
    const byRows = mode !== 'cols';
    const lines = byRows ? rows : cols, len = byRows ? cols : rows;
    const at = (line, i) => (byRows ? [i, line] : [line, i]);
    const chains = [];
    if (len <= cap) {
      const per = Math.floor(cap / len);
      for (let l0 = 0; l0 < lines; l0 += per) {
        const chain = [];
        for (let l = l0; l < Math.min(lines, l0 + per); l++) {
          for (let i = 0; i < len; i++) chain.push(at(l, (l - l0) % 2 ? len - 1 - i : i));
        }
        chains.push(chain);
      }
    } else {
      const parts = Math.ceil(len / cap), size = Math.ceil(len / parts);
      for (let l = 0; l < lines; l++) {
        for (let i0 = 0; i0 < len; i0 += size) {
          const chain = [];
          for (let i = i0; i < Math.min(len, i0 + size); i++) chain.push(at(l, i));
          chains.push(chain);
        }
      }
    }
    return chains;
  }

  // ---------- section controller ----------
  function bind(opts) {
    const $ = id => document.getElementById(id);
    const onChange = opts.onChange || (() => {});
    const asked = {}; // meters the user typed, to say when they were rounded

    function fill() {
      const sel = $('panel');
      const keep = sel.value;
      sel.innerHTML = '';
      sel.add(new Option(I18n.t('panel.custom'), ''));
      let group = null, gKey = null;
      all().forEach(t => {
        if (t.group !== gKey) {
          gKey = t.group;
          group = document.createElement('optgroup');
          group.label = I18n.t(t.group);
          sel.appendChild(group);
        }
        group.appendChild(new Option(`${t.name} (${pitch(t)} mm) — ${t.pxW}×${t.pxH} px`, t.id));
      });
      sel.value = keep;
      $('cabDel').hidden = !(byId(sel.value) || {}).custom;
    }

    // A link or preset can name an unknown type, or one whose pixels were changed by hand.
    function sync() {
      const t = byId($('panel').value);
      if (!t || Number($('cabW').value) !== t.pxW || Number($('cabH').value) !== t.pxH) $('panel').value = '';
      $('cabDel').hidden = !(byId($('panel').value) || {}).custom;
    }

    function fromMeters(id) {
      const t = byId($('panel').value);
      const m = parseFloat($(id).value);
      if (!t || !(m > 0)) return;
      const wide = id === 'scrW';
      $(wide ? 'cabCols' : 'cabRows').value = Math.max(1, Math.round(m * 1000 / (wide ? t.mmW : t.mmH)));
    }

    function choose(t) {
      $('cabOn').checked = true;
      $('cabW').value = t.pxW; $('cabH').value = t.pxH;
      $('cabKg').value = t.kg || ''; $('cabWatt').value = t.watt || '';
      // keep the screen size in meters and recount the cabinets for the new type
      ['scrW', 'scrH'].forEach(id => {
        const m = parseFloat($(id).value);
        if (m > 0 && !(asked[id] > 0)) asked[id] = m;
        fromMeters(id);
      });
      $('cabDel').hidden = !t.custom;
    }

    $('panel').addEventListener('input', () => {
      const t = byId($('panel').value);
      if (t) choose(t);
      else $('cabDel').hidden = true;
    });
    ['scrW', 'scrH'].forEach(id => {
      $(id).addEventListener('input', () => { asked[id] = parseFloat($(id).value); fromMeters(id); });
      $(id).addEventListener('blur', () => onChange()); // show the rounded value
    });
    ['cabW', 'cabH'].forEach(id => $(id).addEventListener('input', () => { $('panel').value = ''; $('cabDel').hidden = true; }));
    ['cabCols', 'cabRows', 'cabW', 'cabH', 'cabOn'].forEach(id => $(id).addEventListener('input', () => { delete asked.scrW; delete asked.scrH; }));

    // custom type form
    const form = $('cabForm');
    const ct = k => $('ct' + k);
    $('cabAdd').addEventListener('click', () => {
      form.hidden = !form.hidden;
      if (form.hidden) return;
      // start from the current cabinet so only what differs needs typing
      const t = byId($('panel').value);
      ct('Name').value = '';
      ct('MmW').value = t ? t.mmW : 500; ct('MmH').value = t ? t.mmH : 500;
      ct('PxW').value = $('cabW').value; ct('PxH').value = $('cabH').value;
      ct('Kg').value = $('cabKg').value; ct('Watt').value = $('cabWatt').value;
      $('ctMsg').textContent = '';
      ct('Name').focus();
    });
    $('ctCancel').addEventListener('click', () => { form.hidden = true; });
    $('ctSave').addEventListener('click', () => {
      const num = k => parseFloat(ct(k).value);
      const t = { mmW: num('MmW'), mmH: num('MmH'), pxW: Math.floor(num('PxW')), pxH: Math.floor(num('PxH')), kg: num('Kg') || 0, watt: num('Watt') || 0 };
      if (!(t.mmW > 0 && t.mmH > 0 && t.pxW > 0 && t.pxH > 0)) { $('ctMsg').textContent = I18n.t('ct.invalid'); return; }
      t.name = ct('Name').value.trim().slice(0, 40) || `P${+(t.mmW / t.pxW).toFixed(2)}`;
      t.id = 'u' + Date.now().toString(36);
      const list = loadCustom();
      list.push(t);
      if (!storeCustom(list)) { $('ctMsg').textContent = I18n.t('tp.storeFail'); return; }
      form.hidden = true;
      fill();
      $('panel').value = t.id;
      choose(byId(t.id));
      onChange();
    });
    $('cabDel').addEventListener('click', () => {
      const id = $('panel').value;
      storeCustom(loadCustom().filter(t => t.id !== id));
      fill();
      $('panel').value = '';
      $('cabDel').hidden = true;
      onChange();
    });

    // s: the page's state (cabOn, cabCols, cabRows, cabW, cabH, cabKg, cabWatt);
    // extra: { error, ports: number | null | undefined }
    function render(s, extra = {}) {
      const t = s.cabOn ? byId($('panel').value) : null;
      $('scrW').disabled = $('scrH').disabled = !t;
      $('scrNote').hidden = !!t;
      const typing = /^scr[WH]$/.test((document.activeElement || {}).id);
      if (!t) { $('scrW').value = ''; $('scrH').value = ''; }
      else if (!typing) { $('scrW').value = fmtM(s.cabCols * t.mmW); $('scrH').value = fmtM(s.cabRows * t.mmH); }

      const box = $('summary');
      box.hidden = !s.cabOn || !(s.cabCols > 0 && s.cabRows > 0 && s.cabW > 0 && s.cabH > 0);
      box.innerHTML = '';
      if (box.hidden) return;
      const o = info(t, s);
      const items = [
        [I18n.t('sum.cabinets'), `${o.count} (${o.cols} × ${o.rows})`],
        [I18n.t('sum.pixels'), `${o.w} × ${o.h} px`],
      ];
      if (t) {
        items.push([I18n.t('sum.size'), `${(o.mmW / 1000).toFixed(2)} × ${(o.mmH / 1000).toFixed(2)} m`]);
        items.push([I18n.t('sum.area'), `${o.area.toFixed(2)} m²`]);
      }
      if (o.kg) items.push([I18n.t('sum.weight'), o.kg >= 1000 ? `${(o.kg / 1000).toFixed(2)} t` : `${Math.round(o.kg)} kg`]);
      if (o.watt) {
        items.push([I18n.t('sum.power'), `${(o.watt / 1000).toFixed(1)} / ${(o.watt / 3000).toFixed(1)} kW`]);
        const u = o.supply;
        items.push([I18n.t('sum.supply'), u.b3 ? I18n.t('sum.supply3', { a: u.b3 }) : '—']);
        items.push([I18n.t('sum.generator'), `${u.kva} kVA`]);
      }
      if (extra.ports !== undefined) items.push([I18n.t('sum.ports'), extra.ports === null ? '—' : String(extra.ports)]);
      items.forEach(([k, v]) => {
        const d = document.createElement('div');
        const a = document.createElement('span'); a.textContent = k;
        const b = document.createElement('b'); b.textContent = v;
        d.append(a, b); box.appendChild(d);
      });

      const notes = [];
      if (extra.error) notes.push(['err', extra.error]);
      if (t && ((asked.scrW > 0 && Math.abs(asked.scrW * 1000 - o.mmW) > 1) || (asked.scrH > 0 && Math.abs(asked.scrH * 1000 - o.mmH) > 1))) {
        notes.push(['', I18n.t('scr.rounded', { w: (o.mmW / 1000).toFixed(2), h: (o.mmH / 1000).toFixed(2) })]);
      }
      if (t) notes.push(['', I18n.t('panel.size', { d: `${(o.diag / 1000).toFixed(2)} m / ${(o.diag / 25.4).toFixed(0)}"` })]);
      if (o.watt) {
        const u = o.supply;
        notes.push(['', I18n.t('sum.load3', { a: Math.ceil(u.i3), b: u.b3 || '—' }) + (u.cee3 ? ' ' + I18n.t('sum.cee', { a: u.cee3 }) : '')]);
        notes.push(['', u.b1 ? I18n.t('sum.load1', { a: Math.ceil(u.i1), b: u.b1 }) : I18n.t('sum.load1No', { a: Math.ceil(u.i1) })]);
        notes.push(['', I18n.t('sum.supplyNote')]);
      }
      if (extra.ports === null) notes.push(['err', I18n.t('sum.portsTooBig')]);
      if (o.kg || o.watt) notes.push(['', I18n.t('sum.typical')]);
      notes.forEach(([cls, text]) => {
        const p = document.createElement('p');
        p.className = 'physical' + (cls ? ' ' + cls : '');
        p.textContent = text;
        box.appendChild(p);
      });
    }

    const resetAsked = () => { delete asked.scrW; delete asked.scrH; };
    const current = () => byId($('panel').value);
    return { fill, sync, render, resetAsked, current };
  }

  global.Cabinets = { BUILTIN, PORT_PX, all, byId, pitch, info, fileTag, portChains, bind };
})(window);
