/* PDF report: the whole project as A4 pages, printed with the browser's own
   "Save as PDF" (vector text, real Arabic shaping, no PDF library).

   Pages are laid out here in millimetres and measured in the browser, so what
   is on screen is what prints: blocks flow onto the next page when they don't
   fit, tables split between rows and repeat their header, maps are sized to the
   space that is left (or start a new page when that would make them too small).
   Needs i18n.js, cabinets.js, project.js. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const t = (k, v) => I18n.t(k, v);
  const PX = 96 / 25.4; // CSS px per mm

  // A4 in mm. Body = page minus margins, running header and footer (see report.css).
  const GEO = {
    portrait: { w: 210, h: 297 },
    landscape: { w: 297, h: 210 },
  };
  const MARGIN_X = 15;
  const BLOCK_GAP = 6; // mm between blocks (report.css .blk + .blk)

  // Port / circuit colours: distinct on white paper and in greyscale order.
  const COLORS = ['#1d5fd6', '#e0560b', '#15803d', '#b4239c', '#0e7c96', '#b7791f', '#c81e1e', '#6d3fd8'];
  const colorOf = i => COLORS[i % COLORS.length];

  let project = null;
  let company = null;

  // ---------- formatting (Latin digits in both languages) ----------
  const nf = d => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const int = n => nf(0).format(Math.round(n));
  const dec = (n, d) => nf(d).format(n);
  const m2 = mm => dec(mm / 1000, 2);
  const isAr = () => I18n.lang === 'ar';
  const iso = s => (isAr() ? '\u2066' + s + '\u2069' : s); // LTR isolate inside Arabic text

  function dateText() {
    const d = project.date || Project.today();
    const [y, mo, da] = d.split('-').map(Number);
    try {
      return new Intl.DateTimeFormat(isAr() ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, mo - 1, da)));
    } catch { return d; }
  }

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // a value that is only numbers and units: kept LTR inside Arabic pages
  function n(tag, cls, text) {
    const e = h(tag, cls, text);
    e.dir = 'ltr';
    return e;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  const screenName = (sc, i) => sc.name || t('pj.screenN', { n: i + 1 });

  // ---------- pages and flow ----------
  function makePage(orient) {
    const pg = h('div', 'page ' + orient);
    const head = h('div', 'run-h');
    head.append(h('span', 'run-co', company.name || ''), h('span', 'run-pj', project.name || t('pj.untitled')));
    const body = h('div', 'body');
    const foot = h('div', 'run-f');
    foot.append(h('span', 'run-copy', company.footer || ''), h('span', 'run-date', dateText()), h('span', 'run-no'));
    // user text (names, footer line) takes its own direction
    [...head.children, foot.firstChild].forEach(e => { e.dir = 'auto'; });
    pg.append(head, body, foot);
    return pg;
  }

  const usedH = body => {
    const last = body.lastElementChild;
    return last ? (last.offsetTop + last.offsetHeight) / PX : 0;
  };
  // fractional check on the last block's bottom (scrollHeight is rounded to whole px)
  const overflows = body => {
    const last = body.lastElementChild;
    if (!last) return false;
    return last.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom - 0.5 || body.scrollHeight > body.clientHeight + 1;
  };

  class Flow {
    // title(cont) → element repeated at the top of every page of this flow (or null)
    constructor(doc, orient, title) {
      this.doc = doc;
      this.orient = orient;
      this.title = title || (() => null);
      this.pages = [];
      this.newPage();
    }
    newPage() {
      const pg = makePage(this.orient);
      this.doc.appendChild(pg);
      this.page = pg;
      this.body = pg.querySelector('.body');
      const ti = this.title(this.pages.length > 0);
      if (ti) { ti.classList.add('blk'); this.body.appendChild(ti); }
      this.base = this.body.children.length;
      this.pages.push(pg);
    }
    get empty() { return this.body.children.length <= this.base; }
    get bodyW() { return GEO[this.orient].w - 2 * MARGIN_X; }
    // free height in mm for the next block, gap included
    free() { return this.body.clientHeight / PX - usedH(this.body) - (this.body.children.length ? BLOCK_GAP : 0); }
    freshFree() {
      if (this._fresh == null) {
        const tmp = makePage(this.orient);
        tmp.style.position = 'absolute';
        tmp.style.visibility = 'hidden';
        this.doc.appendChild(tmp);
        const b = tmp.querySelector('.body');
        const ti = this.title(true);
        if (ti) { ti.classList.add('blk'); b.appendChild(ti); }
        this._fresh = b.clientHeight / PX - usedH(b) - (b.children.length ? BLOCK_GAP : 0);
        tmp.remove();
      }
      return this._fresh;
    }
    measure(el) {
      el.classList.add('blk');
      this.body.appendChild(el);
      const hgt = el.offsetHeight / PX;
      el.remove();
      return hgt;
    }
    add(el) {
      el.classList.add('blk');
      this.body.appendChild(el);
      if (!overflows(this.body) || this.empty || this.body.children.length === this.base + 1) return;
      el.remove();
      this.newPage();
      this.body.appendChild(el);
    }
    /* A table that may split between rows; the header row repeats and a caption
       says it continues. rows: array of <tr>. */
    addTable(make, rows, foot) {
      let table = null, tbody = null, i = 0;
      const start = cont => {
        table = make(cont);
        tbody = table.tBodies[0] || table.appendChild(document.createElement('tbody'));
        table.classList.add('blk');
        this.body.appendChild(table);
      };
      start(false);
      if (overflows(this.body) && !this.empty) { table.remove(); this.newPage(); start(false); }
      while (i < rows.length) {
        tbody.appendChild(rows[i]);
        if (overflows(this.body)) {
          rows[i].remove();
          if (!tbody.rows.length) {
            if (this.empty || this.body.children.length === this.base + 1) { tbody.appendChild(rows[i]); i++; continue; }
            table.remove();
            this.newPage();
            start(false);
            continue;
          }
          this.newPage();
          start(true);
          continue;
        }
        i++;
      }
      if (foot) {
        const tf = table.createTFoot();
        tf.appendChild(foot);
        if (overflows(this.body) && tbody.rows.length > 1) {
          // keep the totals with at least one row
          const last = tbody.rows[tbody.rows.length - 1];
          tf.remove();
          last.remove();
          this.newPage();
          start(true);
          tbody.appendChild(last);
          table.createTFoot().appendChild(foot);
        }
      }
      return table;
    }
    /* Rows that fill k side-by-side tables, then flow on to the next page. */
    addColumns(make, rows, k) {
      let grid = null, tables = [], j = 0, i = 0;
      const start = cont => {
        grid = h('div', 'leg-cols blk');
        grid.style.setProperty('--k', k);
        tables = [];
        for (let c = 0; c < k; c++) { const tb = make(cont && c === 0); tables.push(tb); grid.appendChild(tb); }
        // the caption only sits over the first column: keep the others aligned
        if (cont) tables.slice(1).forEach(tb => { const cap = tb.createCaption(); cap.innerHTML = '&nbsp;'; });
        this.body.appendChild(grid);
        j = 0;
      };
      start(false);
      if (overflows(this.body) && !this.empty) { grid.remove(); this.newPage(); start(true); }
      while (i < rows.length) {
        const tb = tables[j].tBodies[0];
        tb.appendChild(rows[i]);
        if (overflows(this.body)) {
          rows[i].remove();
          if (j < k - 1 && tb.rows.length) { j++; continue; }
          if (!tables[0].tBodies[0].rows.length && (this.empty || this.body.children.length === this.base + 1)) { tb.appendChild(rows[i]); i++; continue; }
          tables.forEach(t2 => { if (!t2.tBodies[0].rows.length) t2.remove(); });
          if (!grid.querySelector('tbody tr')) grid.remove();
          this.newPage();
          start(true);
          continue;
        }
        i++;
      }
      tables.forEach(t2 => { if (!t2.tBodies[0].rows.length) t2.style.visibility = 'hidden'; });
    }
  }

  // captionFirst: false = the caption only appears on continuation pages
  function tableOf(cls, heads, captionText, captionFirst = true) {
    return cont => {
      const tb = h('table', 'tbl ' + (cls || ''));
      if ((captionText && captionFirst) || cont) {
        const c = tb.createCaption();
        c.textContent = cont ? t('rp.continued', { what: captionText || '' }) : captionText;
      }
      const tr = tb.createTHead().insertRow();
      heads.forEach(([label, unit, num]) => {
        const th = h('th', num ? 'num' : '');
        th.append(h('span', 'th-l', label));
        if (unit) th.append(n('span', 'th-u', unit));
        tr.appendChild(th);
      });
      tb.createTBody();
      return tb;
    };
  }
  function row(cells, cls) {
    const tr = h('tr', cls || '');
    cells.forEach(c => {
      if (c instanceof Node) { tr.appendChild(c); return; }
      const [text, num, extra] = Array.isArray(c) ? c : [c];
      const td = num ? n('td', 'num' + (extra ? ' ' + extra : ''), text) : h('td', extra || '', text);
      tr.appendChild(td);
    });
    return tr;
  }
  function swatchCell(i, label, shape) {
    const td = h('td', 'key-cell');
    const sw = h('span', 'sw ' + (shape || ''));
    sw.style.setProperty('--c', colorOf(i));
    td.append(sw, n('span', '', label));
    return td;
  }

  // ---------- cabinet map (inline SVG, mm) ----------
  const NICE = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000];
  const MAX_CELL = 28;    // mm on paper: a 1×1 screen should not fill the page
  const TARGET_CELL = 6.5; // below this, a long screen is split into stacked parts

  function mapGeom(o, maxW, maxH) {
    const cols = o.cabOn ? o.cols : 1, rows = o.cabOn ? o.rows : 1;
    const uw = o.type ? o.type.mmW : (o.cabOn ? o.cabW : o.w);
    const uh = o.type ? o.type.mmH : (o.cabOn ? o.cabH : o.h);
    const rowChars = o.cabOn ? Project.rowLabel(rows - 1).length : 0;
    const gutL = 7 + (o.cabOn ? 1.2 + rowChars * 1.7 : 0);
    const gutT = 7 + (o.cabOn ? 3.6 : 0);
    const segGap = 5;
    let best = null;
    const maxSeg = o.cabOn ? Math.min(cols, 8) : 1;
    for (let k = 1; k <= maxSeg; k++) {
      const segCols = Math.ceil(cols / k);
      const nSeg = Math.ceil(cols / segCols);
      const availW = maxW - gutL - 1;
      const availH = (maxH - nSeg * gutT - (nSeg - 1) * segGap) / nSeg - 1;
      if (availW <= 0 || availH <= 0) break;
      let sc = Math.min(availW / (segCols * uw), availH / (rows * uh), o.cabOn ? MAX_CELL / Math.max(uw, uh) : Infinity);
      let scale = null;
      if (o.type) { // a real drawing scale, 1:S
        const S = NICE.find(v => 1 / v <= sc) || Math.ceil(1 / sc);
        sc = 1 / S;
        scale = S;
      }
      const g = { k: nSeg, segCols, sc, scale, cellW: uw * sc, cellH: uh * sc, gutL, gutT, segGap, cols, rows, uw, uh };
      g.cell = Math.min(g.cellW, g.cellH);
      g.w = gutL + segCols * g.cellW + 1;
      g.h = nSeg * (gutT + rows * g.cellH) + (nSeg - 1) * segGap + 1;
      if (!best || g.cell > best.cell * 1.02) best = g;
      if (g.cell >= TARGET_CELL) break; // the fewest parts that read well
    }
    return best;
  }

  function rulerLabel(mm, px, cab, o) {
    const parts = [];
    if (o.type) parts.push(t('rp.rM', { v: m2(mm) }));
    parts.push(t('rp.rPx', { v: int(px) }));
    if (o.cabOn) parts.push(t('rp.rCab', { v: int(cab) }));
    return parts.join(' · ');
  }

  /* view: 'data' | 'power' | 'plain' */
  function drawMap(o, g, view) {
    const W = g.w, H = g.h;
    const svg = s('svg', { viewBox: `0 0 ${W.toFixed(2)} ${H.toFixed(2)}`, width: W.toFixed(2) + 'mm', height: H.toFixed(2) + 'mm', class: 'map', direction: 'ltr', role: 'img' });
    const ink = '#1b1c1f', mute = '#6b6e75', hair = '#c3c6cc';
    const fs = Math.max(1.55, Math.min(2.5, g.cell * 0.42)); // axis labels
    const cellFs = Math.max(1.5, Math.min(2.3, g.cell * 0.19));
    const showCellLabels = o.cabOn && g.cellW >= 7 && g.cellH >= 5.5;

    for (let seg = 0; seg < g.k; seg++) {
      const c0 = seg * g.segCols, c1 = Math.min(g.cols, c0 + g.segCols);
      const nC = c1 - c0;
      const oy = seg * (g.gutT + g.rows * g.cellH + g.segGap);
      const x0 = g.gutL, y0 = oy + g.gutT;
      const gw = nC * g.cellW, gh = g.rows * g.cellH;
      const grp = s('g', {});
      svg.appendChild(grp);

      // dimension rulers
      const ry = oy + 2.2, rx = 2.2;
      const tick = 1.2;
      const dimW = o.type ? nC * o.type.mmW : 0;
      const pxW = o.cabOn ? nC * o.cabW : o.w;
      const top = g.k > 1
        ? t('rp.rPart', { a: c0 + 1, b: c1, v: rulerLabel(dimW, pxW, nC, o) })
        : rulerLabel(o.mmW || 0, o.w, o.cols, o);
      grp.append(
        s('line', { x1: x0, y1: ry + 1.6, x2: x0 + gw, y2: ry + 1.6, stroke: mute, 'stroke-width': 0.18 }),
        s('line', { x1: x0, y1: ry + 1.6 - tick, x2: x0, y2: ry + 1.6 + tick, stroke: mute, 'stroke-width': 0.18 }),
        s('line', { x1: x0 + gw, y1: ry + 1.6 - tick, x2: x0 + gw, y2: ry + 1.6 + tick, stroke: mute, 'stroke-width': 0.18 }),
      );
      const tl = s('text', { x: x0 + gw / 2, y: ry + 0.6, 'text-anchor': 'middle', 'font-size': 2.3, fill: ink, class: 'rt' }, top);
      tl.setAttribute('direction', isAr() ? 'rtl' : 'ltr');
      grp.appendChild(tl);
      const lx = rx + 1.6;
      grp.append(
        s('line', { x1: lx, y1: y0, x2: lx, y2: y0 + gh, stroke: mute, 'stroke-width': 0.18 }),
        s('line', { x1: lx - tick, y1: y0, x2: lx + tick, y2: y0, stroke: mute, 'stroke-width': 0.18 }),
        s('line', { x1: lx - tick, y1: y0 + gh, x2: lx + tick, y2: y0 + gh, stroke: mute, 'stroke-width': 0.18 }),
      );
      const lt = s('text', { x: 0, y: 0, 'text-anchor': 'middle', 'font-size': 2.3, fill: ink, transform: `translate(${lx - 0.9} ${y0 + gh / 2}) rotate(-90)`, class: 'rt' },
        rulerLabel(o.mmH || 0, o.h, o.rows, o));
      lt.setAttribute('direction', isAr() ? 'rtl' : 'ltr');
      grp.appendChild(lt);

      if (!o.cabOn) {
        grp.appendChild(s('rect', { x: x0, y: y0, width: gw, height: gh, fill: '#f4f5f7', stroke: ink, 'stroke-width': 0.35 }));
        continue;
      }

      // column numbers and row letters (thinned out when they would collide)
      const colStep = [1, 2, 5, 10, 20, 50].find(v => v * g.cellW >= fs * 1.6 * String(g.cols).length * 0.62 + 0.6) || 50;
      for (let c = c0; c < c1; c++) {
        if ((c + 1) % colStep && c !== c0 && c !== c1 - 1) continue;
        grp.appendChild(s('text', { x: x0 + (c - c0 + 0.5) * g.cellW, y: y0 - 1.1, 'text-anchor': 'middle', 'font-size': fs, fill: mute, class: 'ax' }, String(c + 1)));
      }
      const rowStep = [1, 2, 5, 10].find(v => v * g.cellH >= fs * 1.15) || 10;
      for (let r = 0; r < g.rows; r++) {
        if (r % rowStep && r !== g.rows - 1) continue;
        grp.appendChild(s('text', { x: x0 - 1.1, y: y0 + (r + 0.5) * g.cellH + fs * 0.35, 'text-anchor': 'end', 'font-size': fs, fill: mute, class: 'ax' }, Project.rowLabel(r)));
      }

      // cabinets
      const tint = {};
      if (view === 'power' && o.circuits) {
        o.circuits.forEach((ci, i) => ci.cabs.forEach(([c, r]) => { tint[c + ',' + r] = i; }));
      }
      const cells = s('g', { stroke: hair, 'stroke-width': 0.16 });
      for (let r = 0; r < g.rows; r++) {
        for (let c = c0; c < c1; c++) {
          const ti = tint[c + ',' + r];
          const fill = ti == null ? '#fbfbfc' : colorOf(ti);
          const rect = s('rect', { x: x0 + (c - c0) * g.cellW, y: y0 + r * g.cellH, width: g.cellW, height: g.cellH, fill });
          if (ti != null) rect.setAttribute('fill-opacity', '0.16');
          cells.appendChild(rect);
        }
      }
      grp.appendChild(cells);
      if (showCellLabels) {
        const lab = s('g', { 'font-size': cellFs, fill: '#8a8d94', class: 'cl' });
        for (let r = 0; r < g.rows; r++) {
          for (let c = c0; c < c1; c++) {
            lab.appendChild(s('text', { x: x0 + (c - c0) * g.cellW + 0.7, y: y0 + r * g.cellH + 0.6 + cellFs * 0.8 }, Project.rowLabel(r) + (c + 1)));
          }
        }
        grp.appendChild(lab);
      }
      grp.appendChild(s('rect', { x: x0, y: y0, width: gw, height: gh, fill: 'none', stroke: ink, 'stroke-width': 0.3 }));

      // chains: ports (data) or circuits (power)
      const chains = view === 'data' ? (o.ports || []).map(p => p.cabs) : view === 'power' ? (o.circuits || []).map(c => c.cabs) : [];
      const lw = Math.max(0.3, Math.min(0.7, g.cell * 0.06));
      const mr = Math.max(1.35, Math.min(2.6, g.cell * 0.27));
      const ctr = ([c, r]) => [x0 + (c - c0 + 0.5) * g.cellW, y0 + (r + 0.5) * g.cellH];
      const inSeg = ([c]) => c >= c0 && c < c1;
      chains.forEach((cabs, i) => {
        const col = colorOf(i);
        let d = '';
        for (let j = 0; j < cabs.length; j++) {
          const a = cabs[j];
          if (!inSeg(a)) continue;
          const [ax, ay] = ctr(a);
          const prev = cabs[j - 1], next = cabs[j + 1];
          if (prev && !inSeg(prev)) d += `M${(prev[0] < c0 ? x0 : x0 + gw).toFixed(2)} ${ay.toFixed(2)}L${ax.toFixed(2)} ${ay.toFixed(2)}`;
          else if (!prev || !inSeg(prev)) d += `M${ax.toFixed(2)} ${ay.toFixed(2)}`;
          else d += `L${ax.toFixed(2)} ${ay.toFixed(2)}`;
          if (next && !inSeg(next)) d += `L${(next[0] < c0 ? x0 : x0 + gw).toFixed(2)} ${ay.toFixed(2)}`;
        }
        if (d) {
          const path = s('path', { d, fill: 'none', stroke: col, 'stroke-width': view === 'power' ? lw * 0.8 : lw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
          if (view === 'power') path.setAttribute('stroke-dasharray', `${(lw * 2.2).toFixed(2)} ${(lw * 1.6).toFixed(2)}`);
          grp.appendChild(path);
        }
        // end arrow (data only: direction of the signal)
        const last = cabs[cabs.length - 1], before = cabs[cabs.length - 2];
        if (view === 'data' && before && inSeg(last)) {
          const [bx, by] = ctr(last), [ax2, ay2] = inSeg(before) ? ctr(before) : [before[0] < c0 ? x0 : x0 + gw, ctr(last)[1]];
          const ang = Math.atan2(by - ay2, bx - ax2), L = mr * 1.1;
          const p = (a2, l) => `${(bx - l * Math.cos(ang + a2)).toFixed(2)} ${(by - l * Math.sin(ang + a2)).toFixed(2)}`;
          grp.appendChild(s('path', { d: `M${bx.toFixed(2)} ${by.toFixed(2)}L${p(0.45, L)}L${p(-0.45, L)}Z`, fill: col }));
        }
        // start marker with the number
        const first = cabs[0];
        if (inSeg(first)) {
          const [fx, fy] = ctr(first);
          if (view === 'data') grp.appendChild(s('circle', { cx: fx, cy: fy, r: mr, fill: col, stroke: '#fff', 'stroke-width': 0.25 }));
          else grp.appendChild(s('rect', { x: fx - mr, y: fy - mr, width: mr * 2, height: mr * 2, rx: mr * 0.3, fill: col, stroke: '#fff', 'stroke-width': 0.25 }));
          const label = String(i + 1);
          grp.appendChild(s('text', { x: fx, y: fy + mr * 0.36, 'text-anchor': 'middle', 'font-size': (mr * (label.length > 2 ? 0.78 : 1.02)).toFixed(2), fill: '#fff', class: 'mk' }, label));
        }
      });
    }
    return svg;
  }

  // ---------- blocks ----------
  function titleBlock(o, idx, total, cont) {
    const b = h('div', 'scr-title');
    const left = h('div', 'st-l');
    const nm = h('h2', 'st-name', o.name);
    nm.dir = 'auto';
    left.appendChild(nm);
    const sub = [t('rp.screenOf', { n: idx + 1, of: total })];
    if (o.type) sub.push(`${o.type.name} · ${iso(`${dec(o.type.mmW, o.type.mmW % 1 ? 1 : 0)} × ${dec(o.type.mmH, o.type.mmH % 1 ? 1 : 0)} mm`)}`);
    if (cont) sub.push(t('rp.contShort'));
    left.appendChild(h('p', 'st-sub', sub.join(' · ')));
    const right = h('dl', 'st-figs');
    const fig = (label, value) => {
      const d = h('div');
      d.append(h('dt', '', label), n('dd', '', value));
      right.appendChild(d);
    };
    fig(t('rp.resolution'), `${int(o.w)} × ${int(o.h)}`);
    if (o.mmW) fig(t('rp.size'), `${m2(o.mmW)} × ${m2(o.mmH)} m`);
    if (o.cabOn) fig(t('rp.cabinets'), int(o.count));
    b.append(left, right);
    return b;
  }

  function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
  function aspect(w, hh) {
    if (!w || !hh) return '—';
    const g = gcd(w, hh);
    const a = `${w / g}:${hh / g}`;
    if (hh / g === 1) return a;
    return `${a.length > 9 ? '' : a + ' · '}${dec(w / hh, 3)}:1`;
  }

  // key / value pairs, `per` pairs to a row (2 on portrait, 3 on landscape pages)
  function pairTable(items, per, cls) {
    const tb = h('table', 'spec ' + (cls || '') + ' per' + per);
    const body = tb.createTBody();
    for (let i = 0; i < items.length; i += per) {
      const tr = body.insertRow();
      for (let j = 0; j < per; j++) {
        const it = items[i + j];
        if (!it) { tr.append(h('th'), h('td')); continue; }
        tr.append(h('th', '', it[0]), h('td', '', it[1]));
      }
    }
    return tb;
  }

  function specBlock(o, p, per) {
    const el = p.elec;
    const items = [];
    const dash = '—';
    items.push([t('rp.cabGrid'), o.cabOn ? iso(`${o.cols} × ${o.rows}`) + ' ' + t('rp.cabCount', { n: int(o.count) }) : t('rp.noCab')]);
    items.push([t('rp.cabinet'), o.type
      ? iso(`${dec(o.type.mmW, o.type.mmW % 1 ? 1 : 0)} × ${dec(o.type.mmH, o.type.mmH % 1 ? 1 : 0)} mm · ${o.cabW} × ${o.cabH} px`)
      : (o.cabOn ? iso(`${o.cabW} × ${o.cabH} px`) : dash)]);
    items.push([t('rp.pitch'), o.pitch ? iso(`${dec(o.pitch, o.pitch < 1 ? 3 : 2)} mm`) : dash]);
    items.push([t('rp.resolution'), iso(`${int(o.w)} × ${int(o.h)} px`)]);
    items.push([t('rp.totalPx'), iso(`${int(o.pixels)} px`)]);
    items.push([t('rp.aspect'), iso(aspect(o.w, o.h))]);
    items.push([t('rp.size'), o.mmW ? iso(`${m2(o.mmW)} × ${m2(o.mmH)} m`) : dash]);
    items.push([t('rp.area'), o.area ? iso(`${dec(o.area, 2)} m²`) : dash]);
    items.push([t('rp.weight'), o.kg ? iso(`${int(o.kg)} kg`) + ' ' + t('rp.kgEach', { v: dec(o.kgEach, o.kgEach % 1 ? 1 : 0) }) : dash]);
    items.push([t('rp.power'), o.peak ? t('rp.powerVal', { avg: int(o.avg), peak: int(o.peak), a: dec(o.amps, 1), v: int(el.volts) }) : dash]);
    items.push([t('rp.data'), o.ports ? t('rp.dataVal', { n: o.ports.length, px: int(o.portPx) }) : (o.cabOn ? t('rp.portOver') : dash)]);
    items.push([t('rp.circuits'), o.circuits ? t('rp.circVal', { n: o.circuits.length, b: dec(el.breaker, el.breaker % 1 ? 1 : 0), per: o.perCircuit })
      : (o.peak ? t('rp.circOver') : dash)]);
    return pairTable(items, per || 2);
  }

  function mapHeading(view, o, g) {
    const d = h('div', 'map-h');
    const key = view === 'data' ? 'rp.mapData' : view === 'power' ? 'rp.mapPower' : o.cabOn ? 'rp.mapPlain' : 'rp.mapPx';
    d.append(h('h3', '', t(key)));
    const notes = [];
    if (g && g.scale) notes.push(t('rp.scale', { s: int(g.scale) }));
    if (g && g.k > 1) notes.push(t('rp.parts', { n: g.k }));
    if (view === 'data' && o.ports) notes.push(t('rp.dataHint'));
    if (view === 'power' && o.circuits) notes.push(t('rp.powerHint'));
    d.append(h('p', 'map-note', notes.join(' · ')));
    return d;
  }

  const range = cabs => `${Project.cabLabel(cabs[0])} → ${Project.cabLabel(cabs[cabs.length - 1])}`;

  function portLegend(o) {
    const make = tableOf('legend', [[t('rp.port')], [t('rp.cabinets'), '', true], [t('rp.fromTo')], [t('rp.pixels'), 'px', true], [t('rp.load'), '%', true]], t('rp.portsCap'), false);
    const rows = o.ports.map((p, i) => row([swatchCell(i, String(i + 1)), [int(p.cabs.length), true], [range(p.cabs), false, 'ltr-cell'], [int(p.px), true], [dec(p.load * 100, 0), true]]));
    rows.forEach(r => { r.cells[2].dir = 'ltr'; });
    return { make, rows };
  }
  function circuitLegend(o, p) {
    const make = tableOf('legend', [[t('rp.circuit')], [t('rp.phase')], [t('rp.cabinets'), '', true], [t('rp.fromTo')], [t('rp.peakW'), 'W', true], [t('rp.peakA'), 'A', true]], t('rp.circCap', { b: dec(p.elec.breaker, p.elec.breaker % 1 ? 1 : 0), u: int(p.elec.usable) }), false);
    const rows = o.circuits.map((c, i) => row([swatchCell(i, String(i + 1), 'sq'), [c.phase, true], [int(c.cabs.length), true], [range(c.cabs), false], [int(c.w), true], [dec(c.a, 1), true]]));
    rows.forEach(r => { r.cells[3].dir = 'ltr'; });
    return { make, rows };
  }

  // One map with its legend: drawn as large as the space left on this page allows,
  // or on a new page when that would make it much smaller than a fresh page.
  // Legend rows side by side in 2 (portrait) or 3 (landscape) tables, so a long
  // legend stays short enough to sit under its map.
  function legendBlock(legend, orient) {
    const n = legend.rows.length;
    const k = Math.max(1, Math.min(orient === 'landscape' ? 3 : 2, n));
    const per = Math.ceil(n / k);
    const box = h('div', 'leg-cols');
    box.style.setProperty('--k', k);
    for (let i = 0; i < k; i++) {
      const tb = legend.make(false);
      legend.rows.slice(i * per, (i + 1) * per).forEach(r => tb.tBodies[0].appendChild(r));
      box.appendChild(tb);
    }
    return box;
  }

  // pending: a block that should come first (the spec table), unless it would push the
  // map onto a page of its own; then the map goes first and the block follows it.
  function addMapSection(flow, o, view, p, pending) {
    if (pending) {
      flow.add(pending);
      if (!mapFitsHere(flow, o, view, p)) {
        pending.remove();
        addMapSection(flow, o, view, p);
        flow.add(pending);
        return;
      }
    }
    const legend = view === 'data' && o.ports ? portLegend(o) : view === 'power' && o.circuits ? circuitLegend(o, p) : null;
    const headH = flow.measure(mapHeading(view, o, { scale: 100, k: 2 }));
    let legH = 0, legBox = null;
    if (legend) {
      legBox = legendBlock(legend, flow.orient);
      legH = flow.measure(legBox) + 3;
    }
    const fresh = flow.freshFree();
    const splitLegend = legH > fresh * 0.45; // very long legends flow on by themselves
    if (splitLegend) legend.rows.forEach(r => r.remove());
    if (legBox && splitLegend) legBox.remove();
    const reserve = splitLegend ? 0 : legH;
    const W = flow.bodyW;
    const cap = flow.orient === 'portrait' ? 175 : 150;
    const fit = avail => mapGeom(o, W, Math.min(cap, avail - headH - reserve - 1.5));
    let g = fit(flow.free());
    const gFresh = fit(fresh);
    // stay on this page when the map keeps at least ~3/4 of its fresh-page size, or stays large anyway
    if (!flow.empty && (!g || (g.cell < gFresh.cell * 0.74 && g.cell < TARGET_CELL) || g.h < 12)) {
      flow.newPage();
      g = gFresh;
    }
    const sec = h('div', 'map-sec');
    sec.append(mapHeading(view, o, g));
    const wrap = h('div', 'map-wrap');
    wrap.appendChild(drawMap(o, g, view));
    sec.appendChild(wrap);
    if (legend && !splitLegend) sec.appendChild(legBox);
    flow.add(sec);
    if (legend && splitLegend) flow.addColumns(legend.make, legend.rows, flow.orient === 'landscape' ? 3 : 2);
  }

  function mapFitsHere(flow, o, view, p) {
    const legend = view === 'data' && o.ports ? portLegend(o) : view === 'power' && o.circuits ? circuitLegend(o, p) : null;
    const headH = flow.measure(mapHeading(view, o, { scale: 100, k: 2 }));
    let legH = 0;
    if (legend) legH = flow.measure(legendBlock(legend, flow.orient)) + 3;
    const fresh = flow.freshFree();
    const reserve = legH > fresh * 0.45 ? 0 : legH;
    const cap = flow.orient === 'portrait' ? 175 : 150;
    const fit = avail => mapGeom(o, flow.bodyW, Math.min(cap, avail - headH - reserve - 1.5));
    const g = fit(flow.free()), gf = fit(fresh);
    return !!g && !((g.cell < gf.cell * 0.74 && g.cell < TARGET_CELL) || g.h < 12);
  }

  // ---------- pages ----------
  function orientFor(o) {
    if (!o.valid) return 'portrait';
    const fp = mapGeom(o, GEO.portrait.w - 2 * MARGIN_X, 120);
    const fl = mapGeom(o, GEO.landscape.w - 2 * MARGIN_X, 92);
    if (!fl || !fp) return 'portrait';
    // landscape when it avoids splitting a long screen, or gives clearly bigger cabinets
    if (fl.k < fp.k && fl.cell >= TARGET_CELL * 0.95) return 'landscape';
    return fl.cell >= fp.cell * 1.25 ? 'landscape' : 'portrait';
  }

  function coverPage(doc, list) {
    const flow = new Flow(doc, 'portrait');
    // company block
    const co = h('div', 'co');
    if (company.logo) {
      const img = h('img', 'co-logo');
      img.src = company.logo;
      img.alt = '';
      co.appendChild(img);
    }
    const ct = h('div', 'co-t');
    if (company.name) { ct.appendChild(h('p', 'co-name', company.name)); ct.lastChild.dir = 'auto'; }
    const contact = [company.address, company.phone && iso(company.phone), company.email && iso(company.email)].filter(Boolean);
    if (contact.length) ct.appendChild(h('p', 'co-line', contact.join('  ·  ')));
    co.appendChild(ct);
    if (company.logo || company.name || contact.length) flow.add(co);

    const hero = h('div', 'cover-h');
    hero.appendChild(h('p', 'kicker', t('rp.kicker')));
    const ttl = h('h1', 'cover-title', project.name || t('pj.untitled'));
    ttl.dir = 'auto';
    hero.appendChild(ttl);
    const meta = h('dl', 'cover-meta');
    const mi = (k, v) => { const d = h('div'); d.append(h('dt', '', k), h('dd', '', v)); meta.appendChild(d); };
    mi(t('rp.date'), dateText());
    if (project.client) mi(t('rp.client'), project.client);
    mi(t('rp.screensN'), iso(String(list.length)));
    hero.appendChild(meta);
    flow.add(hero);

    if (!list.length) {
      flow.add(h('p', 'empty-note', t('rp.noScreens')));
      return flow;
    }
    const ov = overview(list, flow.bodyW, 70);
    if (ov) flow.add(ov);
    summaryTable(flow, list);
    return flow;
  }

  // All screens side by side at one scale, so their sizes compare at a glance.
  function overview(list, maxW, maxH) {
    const items = list.filter(x => x.o.mmW);
    if (!items.length) return null;
    const CAP_W = 26, CAP_H = 8.5, GAP = 7;
    const rowsFor = k => {
      const rows = [];
      let cur = [], w = 0;
      items.forEach(x => {
        const iw = Math.max(x.o.mmW * k, CAP_W);
        if (cur.length && w + GAP + iw > maxW) { rows.push(cur); cur = []; w = 0; }
        w += (cur.length ? GAP : 0) + iw;
        cur.push(x);
      });
      if (cur.length) rows.push(cur);
      return rows;
    };
    const height = k => rowsFor(k).reduce((a, r) => a + Math.max(...r.map(x => x.o.mmH * k)) + CAP_H, 0) + (rowsFor(k).length - 1) * 4;
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const ok = height(mid) <= maxH && items.every(x => x.o.mmW * mid <= maxW);
      if (ok) lo = mid; else hi = mid;
    }
    const k = 1 / (NICE.find(v => 1 / v <= lo) || Math.ceil(1 / lo));
    const box = h('div', 'overview');
    box.appendChild(h('h3', 'sec-h', t('rp.overview')));
    const fig = h('div', 'ov-fig'); // follows the page direction: screens read in order, sizes don't depend on it
    rowsFor(k).forEach(r => {
      const rr = h('div', 'ov-row');
      r.forEach(x => {
        const it = h('div', 'ov-item');
        it.style.width = Math.max(x.o.mmW * k, CAP_W) + 'mm';
        const w = x.o.mmW * k, hh = x.o.mmH * k;
        const svg = s('svg', { width: w.toFixed(2) + 'mm', height: hh.toFixed(2) + 'mm', viewBox: `0 0 ${w.toFixed(2)} ${hh.toFixed(2)}` });
        svg.appendChild(s('rect', { x: 0, y: 0, width: w, height: hh, fill: '#1b1c1f' }));
        const cw = x.o.type.mmW * k, ch = x.o.type.mmH * k;
        if (cw >= 0.9 && ch >= 0.9) {
          let d = '';
          for (let c = 1; c < x.o.cols; c++) d += `M${(c * cw).toFixed(2)} 0V${hh.toFixed(2)}`;
          for (let r = 1; r < x.o.rows; r++) d += `M0 ${(r * ch).toFixed(2)}H${w.toFixed(2)}`;
          svg.appendChild(s('path', { d, stroke: '#4a4d55', 'stroke-width': 0.12, fill: 'none' }));
        }
        it.appendChild(svg);
        const cap = h('div', 'ov-cap');
        const nm = h('span', 'ov-n', `${x.i + 1}  ${x.name}`);
        nm.dir = 'auto';
        cap.append(nm, n('span', 'ov-s', `${m2(x.o.mmW)} × ${m2(x.o.mmH)} m`));
        it.appendChild(cap);
        rr.appendChild(it);
      });
      fig.appendChild(rr);
    });
    box.appendChild(fig);
    // scale bar: a round number of metres, 15–35 mm long on paper
    const metres = [0.5, 1, 2, 5, 10, 20, 50, 100].find(v => v * 1000 * k >= 15) || 100;
    const bar = h('div', 'ov-scale');
    bar.dir = 'ltr';
    const bw = metres * 1000 * k;
    const svg = s('svg', { width: (bw + 1).toFixed(2) + 'mm', height: '3mm', viewBox: `0 0 ${(bw + 1).toFixed(2)} 3` });
    svg.append(
      s('rect', { x: 0.5, y: 1, width: bw / 2, height: 1, fill: '#1b1c1f' }),
      s('rect', { x: 0.5 + bw / 2, y: 1, width: bw / 2, height: 1, fill: '#fff', stroke: '#1b1c1f', 'stroke-width': 0.2 }),
    );
    bar.append(svg, h('span', '', `${metres} m`), h('span', 'ov-note', t('rp.ovNote', { s: int(1 / k) })));
    box.appendChild(bar);
    return box;
  }

  function summaryTable(flow, list) {
    const make = tableOf('sumtbl', [
      ['#', '', true], [t('rp.screen')], [t('rp.resolution'), 'px'], [t('rp.size'), 'm'], [t('rp.cabinets'), '', true],
      [t('rp.pitchShort'), 'mm', true], [t('rp.pixels'), '', true], [t('rp.area'), 'm²', true], [t('rp.weight'), 'kg', true],
      [t('rp.peak'), 'kW', true], [t('rp.ports'), '', true], [t('rp.circuitsShort'), '', true],
    ], t('rp.summary'));
    const tot = { count: 0, px: 0, area: 0, kg: 0, peak: 0, ports: 0, circ: 0 };
    const dash = '—';
    const rows = list.map(({ o, i, name }) => {
      tot.count += o.count; tot.px += o.pixels; tot.area += o.area || 0; tot.kg += o.kg || 0; tot.peak += o.peak || 0;
      tot.ports += o.ports ? o.ports.length : 0; tot.circ += o.circuits ? o.circuits.length : 0;
      const nm = h('td', 'nm', name);
      nm.dir = 'auto';
      return row([[String(i + 1), true], nm, [`${int(o.w)} × ${int(o.h)}`, false], [o.mmW ? `${m2(o.mmW)} × ${m2(o.mmH)}` : dash, false],
        [o.count ? int(o.count) : dash, true], [o.pitch ? dec(o.pitch, o.pitch < 1 ? 3 : 2) : dash, true], [int(o.pixels), true],
        [o.area ? dec(o.area, 2) : dash, true], [o.kg ? int(o.kg) : dash, true], [o.peak ? dec(o.peak / 1000, 1) : dash, true],
        [o.ports ? int(o.ports.length) : dash, true], [o.circuits ? int(o.circuits.length) : dash, true]]);
    });
    rows.forEach(r => { r.cells[2].dir = 'ltr'; r.cells[3].dir = 'ltr'; });
    const foot = row([['', true], t('rp.total'), '', '', [int(tot.count), true], ['', true], [int(tot.px), true], [dec(tot.area, 2), true],
      [int(tot.kg), true], [dec(tot.peak / 1000, 1), true], [int(tot.ports), true], [int(tot.circ), true]], 'tot');
    flow.addTable(make, rows, foot);
  }

  function screenPages(doc, x, total, p) {
    const o = x.o;
    const orient = orientFor(o);
    const flow = new Flow(doc, orient, cont => titleBlock(o, x.i, total, cont));
    const spec = specBlock(o, p, orient === 'landscape' ? 3 : 2);
    const views = [];
    if (p.report.data && o.ports) views.push('data');
    if (p.report.power && o.circuits) views.push('power');
    if (!views.length && o.valid) views.push('plain');
    if (!views.length) flow.add(spec);
    views.forEach((v, i) => addMapSection(flow, o, v, p, i === 0 ? spec : null));
    return flow;
  }

  function notesBlock(p, list) {
    const el = p.elec;
    const box = h('div', 'notes');
    box.appendChild(h('h3', 'sec-h', t('rp.notes')));
    const ul = h('ul');
    const cw = el.volts * el.pf * el.breaker * el.usable / 100;
    [
      t('rp.nPower', { avg: int(el.avgPct) }),
      t('rp.nAmps', { v: int(el.volts), pf: dec(el.pf, 2) }),
      t('rp.nCircuit', { v: int(el.volts), pf: dec(el.pf, 2), b: dec(el.breaker, el.breaker % 1 ? 1 : 0), u: int(el.usable), w: int(cw) }),
      t('rp.nData', { px: int(Cabinets.PORT_PX) }),
      t('rp.nWeight'),
      p.report.packing && list.length ? t('rp.nSpare', { s: int(p.spare) }) : '',
      t('rp.nCheck'),
    ].filter(Boolean).forEach(x => ul.appendChild(h('li', '', x)));
    box.appendChild(ul);
    return box;
  }

  function packingPages(doc, list, p) {
    const flow = new Flow(doc, 'portrait', () => pageTitle(t('rp.packing')));
    const sp = p.spare / 100;
    const spare = v => Math.ceil(v * sp - 1e-9);
    // cabinets by type
    const groups = new Map();
    list.forEach(({ o, name }) => {
      if (!o.count) return;
      const ty = o.type;
      const key = [ty ? ty.name : '', ty ? ty.mmW : '', ty ? ty.mmH : '', o.cabW, o.cabH, o.kgEach].join('|');
      if (!groups.has(key)) groups.set(key, { ty, cabW: o.cabW, cabH: o.cabH, kg: o.kgEach, n: 0, screens: [] });
      const gr = groups.get(key);
      gr.n += o.count;
      gr.screens.push(name);
    });
    const make = tableOf('pack', [[t('rp.cabType')], [t('rp.cabinet'), 'mm · px'], [t('rp.needed'), '', true], [t('rp.spare', { s: int(p.spare) }), '', true],
      [t('rp.toLoad'), '', true], [t('rp.kgEachH'), 'kg', true], [t('rp.weightLoad'), 'kg', true]], t('rp.packCab'));
    const tot = { n: 0, sp: 0, kg0: 0, kg1: 0 };
    const rows = [...groups.values()].map(gr => {
      const sN = spare(gr.n);
      tot.n += gr.n; tot.sp += sN; tot.kg0 += gr.n * gr.kg; tot.kg1 += (gr.n + sN) * gr.kg;
      const nameCell = h('td', 'nm');
      nameCell.append(h('span', 'b', gr.ty ? gr.ty.name : t('rp.customCab')), h('span', 'sub', gr.screens.join(', ')));
      const dims = gr.ty ? `${dec(gr.ty.mmW, gr.ty.mmW % 1 ? 1 : 0)} × ${dec(gr.ty.mmH, gr.ty.mmH % 1 ? 1 : 0)} · ${gr.cabW} × ${gr.cabH}` : `${gr.cabW} × ${gr.cabH} px`;
      const r = row([nameCell, [dims, false], [int(gr.n), true], [int(sN), true], [int(gr.n + sN), true], [gr.kg ? dec(gr.kg, gr.kg % 1 ? 1 : 0) : '—', true], [gr.kg ? int((gr.n + sN) * gr.kg) : '—', true]]);
      r.cells[1].dir = 'ltr';
      return r;
    });
    if (rows.length) {
      flow.addTable(make, rows, row([t('rp.total'), '', [int(tot.n), true], [int(tot.sp), true], [int(tot.n + tot.sp), true], ['', true], [int(tot.kg1), true]], 'tot'));
      const wl = h('p', 'pack-w', t('rp.weightLine', { a: int(tot.kg0), b: int(tot.kg1) }));
      flow.add(wl);
    }

    // cables and outputs
    let dl = 0, hr = 0, pl = 0, fd = 0;
    list.forEach(({ o }) => { dl += o.dataLinks || 0; hr += o.ports ? o.ports.length : 0; pl += o.powerLinks || 0; fd += o.circuits ? o.circuits.length : 0; });
    const make2 = tableOf('pack', [[t('rp.item')], [t('rp.needed'), '', true], [t('rp.withSpare', { s: int(p.spare) }), '', true]], t('rp.packCable'));
    const items = [
      [t('rp.dataLinks'), dl], [t('rp.homeRuns'), hr], [t('rp.powerLinks'), pl], [t('rp.feeds'), fd],
    ];
    const rows2 = items.map(([k, v]) => row([k, [int(v), true], [int(v + spare(v)), true]]));
    rows2.push(row([t('rp.outputs'), [int(hr), true], ['—', true]]));
    flow.addTable(make2, rows2);

    // per screen
    const make3 = tableOf('pack', [['#', '', true], [t('rp.screen')], [t('rp.cabinets'), '', true], [t('rp.dataLinksS'), '', true], [t('rp.homeRunsS'), '', true],
      [t('rp.powerLinksS'), '', true], [t('rp.feedsS'), '', true], [t('rp.weight'), 'kg', true]], t('rp.packScreen'));
    const rows3 = list.map(({ o, i, name }) => {
      const nm = h('td', 'nm', name);
      nm.dir = 'auto';
      return row([[String(i + 1), true], nm, [o.count ? int(o.count) : '—', true], [o.ports ? int(o.dataLinks) : '—', true], [o.ports ? int(o.ports.length) : '—', true],
        [o.circuits ? int(o.powerLinks) : '—', true], [o.circuits ? int(o.circuits.length) : '—', true], [o.kg ? int(o.kg) : '—', true]]);
    });
    flow.addTable(make3, rows3);
    flow.add(notesBlock(p, list));
    return flow;
  }

  function pageTitle(text) {
    const b = h('div', 'pg-title');
    b.appendChild(h('h2', '', text));
    return b;
  }

  const CODECS = { DXV3: 'DXV3', HAP: 'HAP', HAPQ: 'HAP Q', HAPA: 'HAP Alpha', H264: 'H.264', PRORES: 'ProRes 422 HQ', PRORES4444: 'ProRes 4444' };
  const ext = codec => (codec === 'H264' ? '.mp4' : '.mov');
  function fileName(pattern, o, i, name) {
    const m = project.media;
    const tok = {
      project: Project.slug(project.name, 30) || 'project',
      screen: Project.slug(name, 30) || 'screen' + (i + 1),
      n: String(i + 1).padStart(2, '0'),
      w: String(o.w), h: String(o.h), fps: String(m.fps).replace('.', '-'),
    };
    const base = (pattern || '{screen}').replace(/\{(\w+)\}/g, (a, k) => (k in tok ? tok[k] : a)).replace(/[^A-Za-z0-9._-]+/g, '-');
    return base + ext(m.codec);
  }

  function mediaPages(doc, list, p, withNotes) {
    const m = p.media;
    const flow = new Flow(doc, 'portrait', () => pageTitle(t('rp.media')));
    const items = [
      [t('rp.mServer'), m.server || '—'],
      [t('rp.mCodec'), CODECS[m.codec] || m.codec],
      [t('rp.mQuality'), m.codec === 'DXV3' ? t(m.quality === 'normal' ? 'rp.qNormal' : 'rp.qHigh') : '—'],
      [t('rp.mAlpha'), t(m.alpha ? 'rp.yes' : 'rp.no')],
      [t('rp.mFps'), iso(`${m.fps} fps`)],
      [t('rp.mAudio'), t('rp.audio.' + m.audio)],
      [t('rp.mRate'), m.audio === 'none' ? '—' : iso(`${m.rate === '44.1' ? '44.1' : m.rate} kHz`)],
      [t('rp.mDepth'), m.audio !== 'wav' ? '—' : iso(`${m.depth}-bit`)],
      [t('rp.mNaming'), iso(m.naming || '{screen}')],
    ];
    flow.add(pairTable(items, 2, 'media-spec'));
    const rule = h('p', 'media-rule', t('rp.mRule'));
    flow.add(rule);
    if (list.length) {
      const make = tableOf('media', [['#', '', true], [t('rp.screen')], [t('rp.deliver'), 'px'], [t('rp.aspect')], [t('rp.fileEx')]], t('rp.deliverCap'));
      const rows = list.map(({ o, i, name }) => {
        const nm = h('td', 'nm', name);
        nm.dir = 'auto';
        const r = row([[String(i + 1), true], nm, [`${o.w} × ${o.h}`, false, 'big'], [aspect(o.w, o.h), false], [fileName(m.naming, o, i, name), false, 'fn']]);
        r.cells[2].dir = 'ltr'; r.cells[3].dir = 'ltr'; r.cells[4].dir = 'ltr';
        return r;
      });
      flow.addTable(make, rows);
    }
    if (m.notes && m.notes.trim()) {
      const nb = h('div', 'media-notes');
      nb.append(h('h3', 'sec-h', t('rp.mNotes')), h('p', '', m.notes.trim()));
      nb.lastChild.dir = 'auto';
      flow.add(nb);
    }
    if (withNotes) flow.add(notesBlock(p, list));
    return flow;
  }

  // ---------- render ----------
  let renderToken = 0;
  async function fontsReady() {
    // every face the paper uses, so the first layout is the final one
    const want = ['400 12px Geist', '500 12px Geist', '600 12px Geist', '700 12px Geist', '400 12px "Geist Mono"', '400 12px Cairo', '500 12px Cairo', '600 12px Cairo', '700 12px Cairo'];
    try {
      await Promise.race([
        Promise.all(want.map(f => document.fonts.load(f, f.includes('Cairo') ? 'بب' : 'Ab'))),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    } catch { /* offline: fallback fonts */ }
  }

  function render() {
    const doc = $('doc');
    doc.style.zoom = '';
    doc.innerHTML = '';
    project = Project.load();
    company = Project.loadCompany();
    $('print').disabled = !project;
    if (!project) {
      const e = h('div', 'rp-empty');
      e.append(h('p', '', t('rp.none')));
      const a = h('a', 'pill pill-primary', t('rp.noneLink'));
      a.href = 'test-pattern.html';
      e.appendChild(a);
      doc.appendChild(e);
      document.title = t('rp.docTitle');
      return;
    }
    const list = project.screens.map((sc, i) => ({ sc, i, name: screenName(sc, i), o: { ...Project.compute(sc, project), name: screenName(sc, i) } }));
    const flows = [coverPage(doc, list)];
    list.forEach(x => flows.push(screenPages(doc, x, list.length, project)));
    if (project.report.packing && list.length) flows.push(packingPages(doc, list, project));
    if (project.report.media) flows.push(mediaPages(doc, list, project, !(project.report.packing && list.length)));
    else if (!(project.report.packing && list.length)) {
      const f = new Flow(doc, 'portrait', () => pageTitle(t('rp.notes')));
      f.add(notesBlock(project, list));
    }
    const pages = [...doc.querySelectorAll('.page')];
    pages.forEach((pg, i) => { pg.querySelector('.run-no').textContent = t('rp.pageOf', { n: i + 1, of: pages.length }); });
    let base = Project.slug(project.name, 60);
    if (base.length > 48) base = base.slice(0, 48).replace(/-[^-]*$/, '');
    document.title = `${base || 'Project'}_LED_report_${project.date || Project.today()}`;
    $('rpCount').textContent = t('rp.pagesN', { n: pages.length });
    fitZoom();
  }

  async function rerender() {
    const tok = ++renderToken;
    await fontsReady();
    if (tok !== renderToken) return;
    render();
  }

  // On narrow screens the paper is scaled down to fit (print is always 100 %).
  function fitZoom() {
    const doc = $('doc');
    const avail = doc.parentElement.clientWidth - 2;
    const widest = Math.max(...[...doc.querySelectorAll('.page')].map(p => p.offsetWidth), 1);
    const z = Math.min(1, avail / widest);
    doc.style.zoom = z < 1 ? z.toFixed(3) : '';
  }
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fitZoom, 100); });

  // ---------- settings panel ----------
  function edit(fn) {
    const p = Project.load();
    if (!p) return;
    fn(p);
    if (!Project.save(p)) { msg(t('tp.storeFail'), true); return; }
    queue();
  }
  let qt = null;
  function queue() { clearTimeout(qt); qt = setTimeout(rerender, 200); }
  function msg(text, err) {
    const e = $('rpMsg');
    e.textContent = text || '';
    e.classList.toggle('err', !!err);
  }

  function fillPanel() {
    const p = Project.load();
    const c = Project.loadCompany();
    document.querySelectorAll('#controls [data-pj]').forEach(i => { i.disabled = !p; });
    if (p) {
      $('rpName').value = p.name;
      $('rpClient').value = p.client;
      $('rpDate').value = p.date || Project.today();
      ['data', 'power', 'packing', 'media'].forEach(k => { $('inc_' + k).checked = p.report[k]; });
      ['volts', 'breaker', 'usable', 'avgPct', 'pf'].forEach(k => { $('el_' + k).value = p.elec[k]; });
      $('spare').value = p.spare;
      ['server', 'codec', 'quality', 'fps', 'audio', 'rate', 'depth', 'naming', 'notes'].forEach(k => { $('m_' + k).value = p.media[k]; });
      $('m_alpha').checked = p.media.alpha;
      syncMedia();
    }
    ['name', 'address', 'phone', 'email', 'footer'].forEach(k => { $('co_' + k).value = c[k]; });
    showLogo(c.logo);
  }
  function syncMedia() {
    $('m_qualityWrap').hidden = $('m_codec').value !== 'DXV3';
    $('m_rate').disabled = $('m_audio').value === 'none';
    $('m_depth').disabled = $('m_audio').value !== 'wav';
  }
  function showLogo(src) {
    $('logoHead').hidden = !src;
    $('logoImg').src = src || '';
    $('logoDropText').textContent = t(src ? 'rp.logoChange' : 'rp.logoPick');
  }

  function wire() {
    $('rpName').addEventListener('input', e => edit(p => { p.name = e.target.value.slice(0, 120); }));
    $('rpClient').addEventListener('input', e => edit(p => { p.client = e.target.value.slice(0, 120); }));
    $('rpDate').addEventListener('change', e => edit(p => { p.date = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : ''; }));
    ['data', 'power', 'packing', 'media'].forEach(k => $('inc_' + k).addEventListener('change', e => edit(p => { p.report[k] = e.target.checked; })));
    ['volts', 'breaker', 'usable', 'avgPct', 'pf'].forEach(k => $('el_' + k).addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      edit(p => { p.elec[k] = v; Object.assign(p, Project.normalise(p)); });
    }));
    $('elReset').addEventListener('click', () => {
      edit(p => { p.elec = { ...Project.ELEC }; });
      ['volts', 'breaker', 'usable', 'avgPct', 'pf'].forEach(k => { $('el_' + k).value = Project.ELEC[k]; });
    });
    $('spare').addEventListener('input', e => edit(p => { const v = parseFloat(e.target.value); if (v >= 0 && v <= 100) p.spare = v; }));
    ['server', 'codec', 'quality', 'fps', 'audio', 'rate', 'depth', 'naming', 'notes'].forEach(k => $('m_' + k).addEventListener('input', e => {
      syncMedia();
      edit(p => { p.media[k] = e.target.value.slice(0, k === 'notes' ? 2000 : 120); });
    }));
    $('m_alpha').addEventListener('change', e => edit(p => { p.media.alpha = e.target.checked; }));
    $('mReset').addEventListener('click', () => {
      edit(p => { p.media = { ...Project.MEDIA }; });
      fillPanel();
    });

    ['name', 'address', 'phone', 'email', 'footer'].forEach(k => $('co_' + k).addEventListener('input', e => {
      const c = Project.loadCompany();
      c[k] = e.target.value.slice(0, 200);
      if (!Project.saveCompany(c)) msg(t('tp.storeFail'), true);
      queue();
    }));
    $('logoFile').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) await setLogo(f);
    });
    const drop = $('logoDrop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', async e => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await setLogo(f);
    });
    $('logoRemove').addEventListener('click', () => {
      const c = Project.loadCompany();
      c.logo = '';
      Project.saveCompany(c);
      showLogo('');
      msg('');
      queue();
    });

    $('print').addEventListener('click', () => window.print());
  }

  // Logo for the cover: kept small enough for browser storage.
  const LOGO_MAX = 500 * 1024; // bytes of data URL
  const LOGO_SIDE = 1200;      // px, raster images are scaled down to this
  async function setLogo(f) {
    let url = '';
    try {
      if (f.type === 'image/svg+xml' || /\.svg$/i.test(f.name)) {
        const text = await f.text();
        if (!/<svg[\s>]/i.test(text)) throw new Error('type');
        url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
      } else if (/^image\/(png|jpeg|webp|gif)$/.test(f.type)) {
        const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const k = Math.min(1, LOGO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        if (k < 1 || src.length > LOGO_MAX) {
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.naturalWidth * k));
          cv.height = Math.max(1, Math.round(img.naturalHeight * k));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          url = cv.toDataURL('image/png');
        } else url = src;
      } else throw new Error('type');
    } catch (err) {
      msg(t(err && err.message === 'type' ? 'rp.logoType' : 'ab.logoRead'), true);
      return;
    }
    if (url.length > LOGO_MAX) { msg(t('rp.logoBig', { kb: int(url.length / 1024), max: int(LOGO_MAX / 1024) }), true); return; }
    const c = Project.loadCompany();
    c.logo = url;
    if (!Project.saveCompany(c)) { msg(t('rp.logoStore'), true); return; }
    showLogo(url);
    msg(t('rp.logoSaved'));
    queue();
  }

  window.addEventListener('storage', e => {
    if (e.key === Project.KEY || e.key === Project.CO_KEY) { fillPanel(); queue(); }
  });

  I18n.apply();
  I18n.onChange(() => { showLogo(Project.loadCompany().logo); msg(''); rerender(); });
  wire();
  fillPanel();
  rerender();
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => queue());
  // exposed for tests
  window.Report = { rerender, render, mapGeom };
})();
