/* Abstract background generators.

   Every generator is resolution independent: positions are fractions of W/H
   and sizes are fractions of m = min(W, H), so the small preview and the
   full-resolution export look the same.

   draw(ctx, W, H, t, p)
     t  in [0, 1) — position in the loop. All motion uses whole numbers of
        cycles over t, so frame 0 and frame N are identical (seamless loop).
     p  { seed, palette: [bg, c1, c2, c3, c4], density: 0..1, speed: 1..4 } */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
  function mix(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }

  // colour at position f (0..1) along the accent colours
  function along(cols, f) {
    f = Math.min(1, Math.max(0, f)) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(f));
    return mix(cols[i], cols[i + 1], f - i);
  }

  function prep(p) {
    const all = p.palette.map(rgb);
    return { bg: all[0], cols: all.slice(1), r: rng(p.seed) };
  }

  // ---------------------------------------------------------------- blobs
  function blobs(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const D = Math.hypot(W, H);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const n = 4 + Math.round(p.density * 8);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      const bx = r(), by = r(), ax = 0.08 + r() * 0.22, ay = 0.08 + r() * 0.3;
      const k = 1 + Math.floor(r() * 2), ph = r() * TAU, ph2 = r() * TAU;
      const rad = D * (0.12 + r() * 0.22);
      const a = TAU * t * p.speed * k;
      const x = W * (bx + ax * Math.sin(a + ph));
      const y = H * (by + ay * Math.cos(a + ph2));
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(c, 0.9));
      g.addColorStop(0.45, rgba(c, 0.35));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- waves
  function waves(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgba(bg, 1));
    sky.addColorStop(1, rgba(mix(bg, cols[0], 0.35), 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const layers = 3 + Math.round(p.density * 5);
    const step = Math.max(2, W / 600);
    const lw = Math.max(1, m / 450);
    for (let L = 0; L < layers; L++) {
      const c = cols[L % cols.length];
      const base = H * (0.3 + (0.6 * L) / layers);
      const amp = H * (0.04 + r() * 0.1);
      const cyc1 = 0.6 + r() * 2.2, cyc2 = 1.5 + r() * 3;
      const k = (1 + Math.floor(r() * 2)) * (L % 2 ? 1 : -1);
      const ph = r() * TAU;
      const a = TAU * t * p.speed * k + ph;
      const yAt = x => base + amp * Math.sin(TAU * cyc1 * x / W + a) + amp * 0.35 * Math.sin(TAU * cyc2 * x / W - a * 2);

      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + step; x += step) ctx.lineTo(x, yAt(x));
      ctx.lineTo(W, H);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - amp, 0, H);
      g.addColorStop(0, rgba(c, 0.55));
      g.addColorStop(1, rgba(c, 0.08));
      ctx.fillStyle = g;
      ctx.fill();

      ctx.beginPath();
      for (let x = 0; x <= W + step; x += step) ctx.lineTo(x, yAt(x));
      ctx.strokeStyle = rgba(mix(c, [255, 255, 255], 0.45), 0.7);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- flow
  function flow(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const f1 = 1 + r() * 2.5, f2 = 1 + r() * 2.5, f3 = 0.5 + r() * 1.5;
    const o1 = r() * TAU, o2 = r() * TAU;
    const a = TAU * t * p.speed;
    // angle of the field at (u, v), in units of m
    const field = (u, v) => (Math.sin(u * f1 + o1 + a) + Math.cos(v * f2 + o2 - a) + Math.sin((u + v) * f3 + a)) * Math.PI * 0.6;

    const area = (W / m) * (H / m);
    const n = Math.round((250 + p.density * 900) * Math.sqrt(area));
    const steps = 45, len = 0.008;
    ctx.lineWidth = Math.max(1, m / 650);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      let u = r() * (W / m), v = r() * (H / m);
      const c = cols[i % cols.length];
      ctx.strokeStyle = rgba(c, 0.25 + r() * 0.45);
      ctx.beginPath();
      ctx.moveTo(u * m, v * m);
      for (let s = 0; s < steps; s++) {
        const ang = field(u, v);
        u += Math.cos(ang) * len;
        v += Math.sin(ang) * len;
        ctx.lineTo(u * m, v * m);
      }
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- bokeh
  function bokeh(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    const g0 = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    g0.addColorStop(0, rgba(mix(bg, cols[0], 0.25), 1));
    g0.addColorStop(1, rgba(bg, 1));
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);

    const area = (W / m) * (H / m);
    const n = Math.round((35 + p.density * 140) * Math.sqrt(area));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const c = cols[Math.floor(r() * cols.length)];
      const x0 = r(), y0 = r();
      const rad = m * (0.01 + Math.pow(r(), 2.2) * 0.09);
      const dx = (0.01 + r() * 0.05) * m, dy = (0.01 + r() * 0.05) * m;
      const k = 1 + Math.floor(r() * 2), ph = r() * TAU, ph2 = r() * TAU;
      const al = 0.12 + r() * 0.3;
      const a = TAU * t * p.speed * k;
      const x = x0 * W + dx * Math.sin(a + ph);
      const y = y0 * H + dy * Math.cos(a + ph2);
      const tw = 0.65 + 0.35 * Math.sin(a + ph2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(c, al * 0.7 * tw));
      g.addColorStop(0.8, rgba(c, al * tw));
      g.addColorStop(0.92, rgba(mix(c, [255, 255, 255], 0.3), al * 1.2 * tw));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- low-poly
  function lowpoly(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const cell = m / (3 + p.density * 9);
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
    const sx = W / (nx - 1), sy = H / (ny - 1);
    const a = TAU * t * p.speed;
    const pts = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const edgeX = i === 0 || i === nx - 1, edgeY = j === 0 || j === ny - 1;
        const jx = edgeX ? 0 : (r() - 0.5) * 0.7, jy = edgeY ? 0 : (r() - 0.5) * 0.7;
        const ph = r() * TAU;
        const wob = 0.12;
        pts.push([
          (i + jx + (edgeX ? 0 : wob * Math.sin(a + ph))) * sx,
          (j + jy + (edgeY ? 0 : wob * Math.cos(a + ph))) * sy,
        ]);
      }
    }
    const P = (i, j) => pts[j * nx + i];
    const tilt = r() * 0.6 + 0.2;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
        const flip = (i + j) % 2;
        const tris = flip ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]];
        tris.forEach((tr, ti) => {
          const cx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3, cy = (tr[0][1] + tr[1][1] + tr[2][1]) / 3;
          const f = (cx / W) * (1 - tilt) + (cy / H) * tilt;
          const ph = r() * TAU;
          const lum = 0.78 + 0.22 * Math.sin(a + ph) + (ti ? -0.05 : 0.05);
          const base = along(cols, f);
          const c = lum > 1 ? mix(base, [255, 255, 255], lum - 1) : mix(bg, base, lum);
          ctx.fillStyle = ctx.strokeStyle = rgba(c, 1);
          ctx.beginPath();
          ctx.moveTo(tr[0][0], tr[0][1]);
          ctx.lineTo(tr[1][0], tr[1][1]);
          ctx.lineTo(tr[2][0], tr[2][1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke(); // same colour: hides hairline seams between triangles
        });
      }
    }
  }

  // ---------------------------------------------------------------- gradient
  function gradient(ctx, W, H, t, p) {
    const { cols, r } = prep(p);
    const ang = r() * TAU;
    const a = TAU * t * p.speed;
    const cx = W / 2, cy = H / 2;
    const L = Math.hypot(W, H) / 2;
    const dx = Math.cos(ang + 0.35 * Math.sin(a)) * L, dy = Math.sin(ang + 0.35 * Math.sin(a)) * L;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    const shift = (Math.sin(a) + 1) * 0.08;
    cols.forEach((c, i) => g.addColorStop(Math.min(1, Math.max(0, i / (cols.length - 1) + (i % 2 ? shift : -shift) * (i && i < cols.length - 1 ? 1 : 0))), rgba(c, 1)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft glow that drifts in a loop
    const gx = W * (0.5 + 0.35 * Math.cos(a)), gy = H * (0.5 + 0.35 * Math.sin(a));
    const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.hypot(W, H) * 0.4);
    rg.addColorStop(0, 'rgba(255,255,255,0.18)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }


  // ================================================================ more animated styles

  // ---------------------------------------------------------------- aurora
  function aurora(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgba(bg, 1));
    sky.addColorStop(1, rgba(mix(bg, cols[1 % cols.length], 0.18), 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const ribbons = 3 + Math.round(p.density * 3);
    const step = Math.max(2, W / 500);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ribbons; i++) {
      const c = cols[i % cols.length];
      const base = H * (0.25 + r() * 0.45);
      const amp = H * (0.06 + r() * 0.12);
      const thick = H * (0.18 + r() * 0.22);
      const f1 = 0.5 + r() * 1.5, f2 = 1.5 + r() * 2.5;
      const k = (1 + Math.floor(r() * 2)) * (i % 2 ? 1 : -1);
      const ph = r() * TAU;
      const a = TAU * t * p.speed * k + ph;
      const top = x => base + amp * Math.sin(TAU * f1 * x / W + a) + amp * 0.4 * Math.sin(TAU * f2 * x / W - a);
      // soft curtain: a few stacked translucent layers
      for (let L = 0; L < 4; L++) {
        const off = L * thick * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, top(0) - off);
        for (let x = 0; x <= W + step; x += step) ctx.lineTo(x, top(x) - off);
        for (let x = W + step; x >= 0; x -= step) ctx.lineTo(x, top(x) + thick * (0.7 + 0.3 * Math.sin(TAU * x / W * 2 + a)));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, base - amp - thick * 0.3, 0, base + amp + thick);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.35, rgba(c, 0.16));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- constellation
  function constellation(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    const g0 = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    g0.addColorStop(0, rgba(mix(bg, cols[0], 0.18), 1));
    g0.addColorStop(1, rgba(bg, 1));
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);
    const area = (W / m) * (H / m);
    const n = Math.round((40 + p.density * 90) * Math.sqrt(area));
    const pts = [];
    const a = TAU * t * p.speed;
    for (let i = 0; i < n; i++) {
      const k = 1 + Math.floor(r() * 2);
      const ax = (0.02 + r() * 0.05) * m, ay = (0.02 + r() * 0.05) * m;
      const ph = r() * TAU, ph2 = r() * TAU;
      const x0 = r() * W, y0 = r() * H;
      pts.push({ x: x0 + ax * Math.sin(a * k + ph), y: y0 + ay * Math.cos(a * k + ph2), c: cols[i % cols.length] });
    }
    const D = m * 0.16, D2 = D * D;
    ctx.lineWidth = Math.max(1, m / 900);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d2 = dx * dx + dy * dy;
        if (d2 > D2) continue;
        ctx.strokeStyle = rgba(pts[i].c, (1 - Math.sqrt(d2) / D) * 0.5);
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
    const rad = Math.max(1.5, m / 320);
    pts.forEach(q => {
      ctx.fillStyle = rgba(mix(q.c, [255, 255, 255], 0.4), 0.95);
      ctx.beginPath();
      ctx.arc(q.x, q.y, rad, 0, TAU);
      ctx.fill();
    });
  }

  // ---------------------------------------------------------------- ripples
  function ripples(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const centres = 1 + Math.round(p.density * 2);
    const rings = 7 + Math.round(p.density * 6);
    const Rmax = Math.hypot(W, H) * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    for (let c = 0; c < centres; c++) {
      const cx = W * (0.15 + r() * 0.7), cy = H * (0.2 + r() * 0.6);
      const col = cols[c % cols.length];
      for (let i = 0; i < rings; i++) {
        // ring position wraps every 1/speed of the clip: whole cycles, seamless
        const f = (((i / rings) + t * p.speed) % 1 + 1) % 1;
        const rad = f * Rmax;
        const alpha = Math.sin(Math.PI * f) * 0.55; // 0 at birth and at the edge
        ctx.strokeStyle = rgba(mix(col, cols[(c + 1) % cols.length], f), alpha);
        ctx.lineWidth = Math.max(1, m * (0.004 + 0.012 * f));
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0.5, rad), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- retro grid
  function retrogrid(ctx, W, H, t, p) {
    const { bg, cols } = prep(p);
    const hz = H * 0.56;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, rgba(bg, 1));
    sky.addColorStop(1, rgba(mix(bg, cols[0], 0.45), 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);
    // sun with cut bands
    const sr = Math.min(W * 0.18, hz * 0.62);
    const sx = W / 2, sy = hz - sr * 0.15;
    const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    sg.addColorStop(0, rgba(cols[2 % cols.length], 1));
    sg.addColorStop(1, rgba(cols[0], 1));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, hz);
    ctx.clip();
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(mix(bg, cols[0], 0.45), 1);
    for (let i = 0; i < 6; i++) {
      const y = sy + sr * (0.05 + i * 0.16), h = sr * (0.03 + i * 0.018);
      ctx.fillRect(sx - sr, y, sr * 2, h);
    }
    ctx.restore();
    // floor
    const floor = ctx.createLinearGradient(0, hz, 0, H);
    floor.addColorStop(0, rgba(mix(bg, cols[1 % cols.length], 0.25), 1));
    floor.addColorStop(1, rgba(bg, 1));
    ctx.fillStyle = floor;
    ctx.fillRect(0, hz, W, H - hz);
    const lineCol = cols[1 % cols.length];
    const lw = Math.max(1, Math.min(W, H) / 500);
    ctx.lineWidth = lw;
    ctx.strokeStyle = rgba(lineCol, 0.85);
    // horizontal lines flow toward the viewer; one full spacing per cycle
    const rows = 14;
    const shift = (t * p.speed * 2) % 1;
    for (let i = 0; i < rows; i++) {
      const z = (i + shift) / rows;          // 0 at horizon, 1 at bottom
      const y = hz + (H - hz) * z * z;
      ctx.globalAlpha = Math.min(1, z * 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const cols2 = Math.round(10 + p.density * 16);
    for (let i = -cols2; i <= cols2; i++) {
      const xb = W / 2 + (i / cols2) * W * 1.6;
      ctx.beginPath();
      ctx.moveTo(W / 2 + (i / cols2) * W * 0.04, hz);
      ctx.lineTo(xb, H);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(lineCol, 0.9);
    ctx.fillRect(0, hz - lw / 2, W, lw);
  }

  // ---------------------------------------------------------------- moving stripes
  function stripes(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const D = Math.hypot(W, H);
    const ang = (r() * 0.5 + 0.15) * Math.PI;
    const n = 4 + Math.round(p.density * 8);                 // bands per repeat
    const period = D / (1.2 + p.density * 1.2);              // one repeat length
    const widths = [];
    for (let i = 0; i < n; i++) widths.push(0.4 + r());
    const sum = widths.reduce((a, b) => a + b, 0);
    const shift = ((t * p.speed) % 1) * period;              // one repeat per cycle: seamless
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(ang);
    for (let rep = -2; rep <= Math.ceil(D / period) + 1; rep++) {
      let x = rep * period - D / 2 - period + shift;
      widths.forEach((w, i) => {
        const bw = (w / sum) * period;
        const c = cols[i % cols.length];
        const g = ctx.createLinearGradient(x, 0, x + bw, 0);
        g.addColorStop(0, rgba(c, 0.0));
        g.addColorStop(0.5, rgba(c, 0.55));
        g.addColorStop(1, rgba(c, 0.0));
        ctx.fillStyle = g;
        ctx.fillRect(x, -D, bw, D * 2);
        x += bw;
      });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- starfield
  function starfield(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const R = Math.hypot(W, H) / 2;
    const n = Math.round(250 + p.density * 900);
    const base = Math.min(W, H) / 600;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    glow.addColorStop(0, rgba(mix(bg, cols[0], 0.3), 1));
    glow.addColorStop(1, rgba(bg, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const dir = r() * TAU, spread = 0.03 + r() * 0.97, z0 = r();
      const c = cols[Math.floor(r() * cols.length)];
      // depth wraps every cycle: stars fly out and are reborn at the centre
      const z = 1 - (((z0 + t * p.speed) % 1 + 1) % 1);
      const d = (spread * 0.12 * R) / Math.max(0.02, z);
      if (d > R * 1.1) continue;
      const d0 = (spread * 0.12 * R) / Math.min(1, Math.max(0.02, z) + 0.12); // a moment earlier: the trail
      const ux = Math.cos(dir), uy = Math.sin(dir);
      const s = base * (0.6 + (1 - z) * 2.4);
      const alpha = Math.min(1, (1 - z) * 1.8);
      const col = mix(c, [255, 255, 255], 0.5);
      const g = ctx.createLinearGradient(cx + ux * d0, cy + uy * d0, cx + ux * d, cy + uy * d);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(1, rgba(col, alpha));
      ctx.strokeStyle = g;
      ctx.lineWidth = s;
      ctx.beginPath();
      ctx.moveTo(cx + ux * d0, cy + uy * d0);
      ctx.lineTo(cx + ux * d, cy + uy * d);
      ctx.stroke();
    }
  }

  // ================================================================ falling lines
  // Each streak's position is frac(start + t * k) with a whole number k, so
  // every streak is back where it started at the end of the clip: seamless.
  const frac = x => ((x % 1) + 1) % 1;

  // ---------------------------------------------------------------- waterfall
  function waterfall(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    const g0 = ctx.createLinearGradient(0, 0, 0, H);
    g0.addColorStop(0, rgba(bg, 1));
    g0.addColorStop(1, rgba(mix(bg, cols[0], 0.3), 1));
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);
    const n = Math.round((60 + p.density * 220) * (W / m));      // lines across the width
    const lw = Math.max(1, m / 700);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x0 = (i + r()) / n * W;
      const sway = (0.004 + r() * 0.01) * m, sk = 1 + Math.floor(r() * 2), sph = r() * TAU;
      const c = cols[i % cols.length];
      const drops = 1 + Math.floor(r() * 3);
      const k = p.speed * (1 + Math.floor(r() * 3));               // falls 1–3 screens per cycle
      const len = H * (0.25 + r() * 0.5);
      const w = lw * (0.6 + r() * 1.4);
      for (let d = 0; d < drops; d++) {
        const head = frac(r() + t * k) * (H + len);                 // 0..H+len
        const y1 = head, y0 = head - len;
        const x = x0 + sway * Math.sin(TAU * t * sk + sph + head / H * 2);
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.85, rgba(c, 0.55));
        g.addColorStop(1, rgba(mix(c, [255, 255, 255], 0.6), 0.95));
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, Math.max(-len, y0));
        ctx.lineTo(x, Math.min(H + len, y1));
        ctx.stroke();
      }
    }
    // mist where the water lands
    const mist = ctx.createLinearGradient(0, H * 0.75, 0, H);
    mist.addColorStop(0, rgba(cols[1 % cols.length], 0));
    mist.addColorStop(1, rgba(cols[1 % cols.length], 0.35));
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- light rain
  function rain(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const slant = (r() - 0.5) * 0.35;                               // gentle wind
    const area = (W / m) * (H / m);
    const n = Math.round((150 + p.density * 600) * Math.sqrt(area));
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const depth = r();                                            // 0 far .. 1 near
      const c = cols[i % cols.length];
      const k = p.speed * (1 + Math.round(depth * 3));              // near drops fall faster
      const len = m * (0.03 + depth * 0.12);
      const travel = H + len;
      const head = frac(r() + t * k) * travel;
      const x = r() * (W + Math.abs(slant) * H) - (slant > 0 ? slant * H : 0) + slant * head;
      ctx.strokeStyle = rgba(mix(c, [255, 255, 255], 0.35), 0.15 + depth * 0.6);
      ctx.lineWidth = Math.max(1, m / 1400 * (1 + depth * 3));
      ctx.beginPath();
      ctx.moveTo(x - slant * len, head - len);
      ctx.lineTo(x, head);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- code rain
  const GLYPHS = '0123456789ABCDEF<>/{}[]=+*#';
  function coderain(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const cell = m / (22 + p.density * 30);
    const colsN = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    ctx.font = `600 ${cell * 0.82}px "Geist Mono", ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < colsN; c++) {
      const col = cols[c % cols.length];
      const trail = 6 + Math.floor(r() * 18);
      const k = p.speed * (1 + Math.floor(r() * 3));
      const head = Math.floor(frac(r() + t * k) * (rows + trail));
      const seed = Math.floor(r() * 1e6);
      const flick = 1 + Math.floor(r() * 4);
      for (let j = 0; j < trail; j++) {
        const row = head - j;
        if (row < 0 || row >= rows) continue;
        const a = j === 0 ? 1 : (1 - j / trail) * 0.75;
        // glyphs change a whole number of times per cycle (loop-safe)
        const g = GLYPHS[(seed + row * 7 + Math.floor(frac(t * flick + row * 0.13) * 8) * 13) % GLYPHS.length];
        ctx.fillStyle = j === 0 ? rgba(mix(col, [255, 255, 255], 0.75), 1) : rgba(col, a);
        ctx.fillText(g, c * cell + cell / 2, row * cell + cell / 2);
      }
    }
  }

  // ---------------------------------------------------------------- meteor shower
  function meteors(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    const g0 = ctx.createLinearGradient(0, 0, W, H);
    g0.addColorStop(0, rgba(mix(bg, cols[0], 0.2), 1));
    g0.addColorStop(1, rgba(bg, 1));
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);
    const ang = Math.PI * (0.62 + r() * 0.12);                    // falling down-left / down-right
    const dir = r() < 0.5 ? 1 : -1;
    const ux = Math.cos(ang) * dir, uy = Math.sin(ang);
    const span = Math.hypot(W, H);
    const n = Math.round(18 + p.density * 60);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      const k = p.speed * (1 + Math.floor(r() * 2));
      const len = span * (0.08 + r() * 0.2);
      // start above the screen, shifted upwind so every meteor crosses it
      const sx = r() * (W + span * 0.6) - (ux > 0 ? span * 0.6 : 0);
      const sy = -r() * H * 0.5;
      const d = frac(r() + t * k) * (span + len);
      const hx = sx + ux * d, hy = sy + uy * d;
      const tx = hx - ux * len, ty = hy - uy * len;
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, rgba(c, 0));
      g.addColorStop(1, rgba(mix(c, [255, 255, 255], 0.6), 0.95));
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, m / 500 * (0.6 + r()));
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ================================================================ static styles (ignore t)

  function solid(ctx, W, H, t, p) {
    const { bg, cols } = prep(p);
    const c = cols[0];
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, rgba(c, 1));
    g.addColorStop(1, rgba(mix(c, bg, 0.55), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function linear(ctx, W, H, t, p) {
    const { cols, r } = prep(p);
    const ang = r() * TAU;
    const L = Math.hypot(W, H) / 2;
    const dx = Math.cos(ang) * L, dy = Math.sin(ang) * L;
    const g = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
    const use = cols.slice(0, 3);
    use.forEach((c, i) => g.addColorStop(i / (use.length - 1), rgba(c, 1)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function spotlight(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const D = Math.hypot(W, H);
    ctx.globalCompositeOperation = 'screen';
    [[0.5 + (r() - 0.5) * 0.3, 0.35 + (r() - 0.5) * 0.2, 0.55, 0], [r(), 0.9, 0.4, 1]].forEach(([x, y, rad, ci]) => {
      const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, D * rad);
      g.addColorStop(0, rgba(cols[ci % cols.length], 0.85));
      g.addColorStop(1, rgba(cols[ci % cols.length], 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function halftone(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    ctx.fillStyle = rgba(bg, 1);
    ctx.fillRect(0, 0, W, H);
    const cell = m / (14 + p.density * 30);
    const ang = r() * TAU;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const half = Math.hypot(W, H) / 2;
    for (let y = cell / 2; y < H + cell; y += cell) {
      for (let x = cell / 2; x < W + cell; x += cell) {
        // dot size and colour follow a diagonal sweep across the screen
        const f = (((x - W / 2) * ux + (y - H / 2) * uy) / half + 1) / 2;
        const rad = cell * 0.48 * Math.max(0.05, f);
        ctx.fillStyle = rgba(along(cols, f), 1);
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
      }
    }
  }

  function topo(ctx, W, H, t, p) {
    const { bg, cols, r } = prep(p);
    const m = Math.min(W, H);
    const f1 = 1.2 + r() * 1.5, f2 = 1.2 + r() * 1.5, f3 = 0.6 + r(), o1 = r() * TAU, o2 = r() * TAU;
    const levels = 10 + Math.round(p.density * 14);
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const line = mix(cols[0], [255, 255, 255], 0.25), line2 = cols[1 % cols.length];
    const lw = 0.06; // line thickness in level units
    for (let y = 0; y < H; y++) {
      const v = y / m;
      for (let x = 0; x < W; x++) {
        const u = x / m;
        const fld = (Math.sin(u * f1 + o1) + Math.cos(v * f2 + o2) + 0.6 * Math.sin((u - v) * f3 * 2)) / 2.6 * 0.5 + 0.5;
        const q = fld * levels, fr = q - Math.floor(q);
        const dist = Math.min(fr, 1 - fr);
        const a = Math.max(0, 1 - dist / lw);             // soft anti-aliased line
        const major = Math.floor(q + 0.5) % 5 === 0;
        const c = major ? line2 : line;
        const k = a * (major ? 1 : 0.6);
        const i = (y * W + x) * 4;
        d[i] = bg[0] + (c[0] - bg[0]) * k;
        d[i + 1] = bg[1] + (c[1] - bg[1]) * k;
        d[i + 2] = bg[2] + (c[2] - bg[2]) * k;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function mesh(ctx, W, H, t, p) {
    const { cols, r } = prep(p);
    // smooth field in a small buffer, scaled up (it has no detail to lose)
    const bw = 64, bh = Math.max(2, Math.round(64 * H / W)) || 2;
    const c = document.createElement('canvas');
    c.width = bw; c.height = bh;
    const g = c.getContext('2d');
    const img = g.createImageData(bw, bh);
    const pts = cols.map(col => ({ x: r(), y: r(), col }));
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let sw = 0; const acc = [0, 0, 0];
        pts.forEach(q => {
          const dx = x / (bw - 1) - q.x, dy = (y / (bh - 1) - q.y) * (H / W);
          const w = 1 / Math.pow(dx * dx + dy * dy + 0.002, 1.4);
          sw += w; acc[0] += q.col[0] * w; acc[1] += q.col[1] * w; acc[2] += q.col[2] * w;
        });
        const i = (y * bw + x) * 4;
        img.data[i] = acc[0] / sw; img.data[i + 1] = acc[1] / sw; img.data[i + 2] = acc[2] / sw; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c, 0, 0, W, H);
    ctx.restore();
  }

  // ---------------------------------------------------------------- grain
  // A fixed noise tile drawn softly on top hides 8-bit banding in smooth
  // gradients, which is very visible on LED walls.
  let noiseTile = null;
  function grain(ctx, W, H) {
    if (!noiseTile) {
      noiseTile = document.createElement('canvas');
      noiseTile.width = noiseTile.height = 128;
      const c = noiseTile.getContext('2d');
      const img = c.createImageData(128, 128);
      const r = rng(1234);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (r() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(noiseTile, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // kind: 'animated' moves in videos; 'static' is a still design (t is ignored)
  const STYLES = [
    { id: 'blobs', name: 'Gradient Blobs', draw: blobs, kind: 'animated' },
    { id: 'waves', name: 'Waves', draw: waves, kind: 'animated' },
    { id: 'aurora', name: 'Aurora', draw: aurora, kind: 'animated' },
    { id: 'flow', name: 'Flow Lines', draw: flow, kind: 'animated' },
    { id: 'bokeh', name: 'Bokeh', draw: bokeh, kind: 'animated' },
    { id: 'constellation', name: 'Constellation', draw: constellation, kind: 'animated' },
    { id: 'ripples', name: 'Ripples', draw: ripples, kind: 'animated' },
    { id: 'starfield', name: 'Starfield', draw: starfield, kind: 'animated' },
    { id: 'retrogrid', name: 'Retro Grid', draw: retrogrid, kind: 'animated' },
    { id: 'stripes', name: 'Light Stripes', draw: stripes, kind: 'animated' },
    { id: 'waterfall', name: 'Waterfall', draw: waterfall, kind: 'animated' },
    { id: 'rain', name: 'Light Rain', draw: rain, kind: 'animated' },
    { id: 'coderain', name: 'Code Rain', draw: coderain, kind: 'animated' },
    { id: 'meteors', name: 'Meteor Shower', draw: meteors, kind: 'animated' },
    { id: 'lowpoly', name: 'Low Poly', draw: lowpoly, kind: 'animated' },
    { id: 'gradient', name: 'Smooth Gradient', draw: gradient, kind: 'animated' },
    { id: 'mesh', name: 'Mesh Gradient', draw: mesh, kind: 'static' },
    { id: 'linear', name: 'Linear Gradient', draw: linear, kind: 'static' },
    { id: 'spotlight', name: 'Spotlight', draw: spotlight, kind: 'static' },
    { id: 'solid', name: 'Solid Color', draw: solid, kind: 'static' },
    { id: 'halftone', name: 'Halftone Dots', draw: halftone, kind: 'static' },
    { id: 'topo', name: 'Topographic', draw: topo, kind: 'static' },
  ];

  const PALETTES = [
    { id: 'ocean', name: 'Ocean', colors: ['#020b1a', '#0a4d8c', '#00a6c8', '#36e0d0', '#7b5cff'] },
    { id: 'sunset', name: 'Sunset', colors: ['#14060f', '#ff5e3a', '#ff2a68', '#ffb347', '#7a1fa2'] },
    { id: 'neon', name: 'Neon', colors: ['#05010d', '#ff00c8', '#00f0ff', '#7c3aed', '#00ff88'] },
    { id: 'aurora', name: 'Aurora', colors: ['#010814', '#00ff9d', '#00b3ff', '#8a2be2', '#00ffd5'] },
    { id: 'corporate', name: 'Corporate', colors: ['#06101f', '#0b5ed7', '#1e90ff', '#6ec6ff', '#c9e6ff'] },
    { id: 'fire', name: 'Fire', colors: ['#0d0200', '#ff3d00', '#ff8a00', '#ffd000', '#b30000'] },
    { id: 'gold', name: 'Gold & Black', colors: ['#050505', '#c9a227', '#f5d76e', '#8c6a12', '#fff1b8'] },
    { id: 'pastel', name: 'Pastel', colors: ['#1b1b2f', '#ffadad', '#a0c4ff', '#caffbf', '#ffd6a5'] },
  ];

  function render(ctx, W, H, t, p) {
    const s = STYLES.find(x => x.id === p.style) || STYLES[0];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    s.draw(ctx, W, H, t, p);
    ctx.restore();
    if (p.grain) grain(ctx, W, H);
  }

  global.Abstract = { STYLES, PALETTES, render };
})(window);
