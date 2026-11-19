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

  const STYLES = [
    { id: 'blobs', name: 'Gradient Blobs', draw: blobs },
    { id: 'waves', name: 'Waves', draw: waves },
    { id: 'flow', name: 'Flow Lines', draw: flow },
    { id: 'bokeh', name: 'Bokeh', draw: bokeh },
    { id: 'lowpoly', name: 'Low Poly', draw: lowpoly },
    { id: 'gradient', name: 'Smooth Gradient', draw: gradient },
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
