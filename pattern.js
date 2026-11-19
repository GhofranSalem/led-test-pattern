/* Test-pattern drawing. Everything is drawn in integer pixel coordinates
   (fillRect) so 1px lines stay exactly 1px in the exported PNG. */
(function (global) {
  'use strict';

  function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

  function aspect(W, H) {
    const g = gcd(W, H);
    return `${W / g}:${H / g}`;
  }

  function hline(ctx, x, y, w, t) { ctx.fillRect(x, y, w, t); }
  function vline(ctx, x, y, h, t) { ctx.fillRect(x, y, t, h); }

  // ---------- backgrounds ----------
  function bgSolid(ctx, W, H, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
  }

  // Exact 8-bit ramp: one fillRect per column, no gradient dithering.
  function ramp(ctx, x0, y0, w, h, toColor) {
    for (let x = 0; x < w; x++) {
      const v = w === 1 ? 255 : Math.round((x / (w - 1)) * 255);
      ctx.fillStyle = toColor(v);
      ctx.fillRect(x0 + x, y0, 1, h);
    }
  }

  function steps(ctx, x0, y0, w, h, n, toColor) {
    for (let i = 0; i < n; i++) {
      const a = x0 + Math.round((i * w) / n);
      const b = x0 + Math.round(((i + 1) * w) / n);
      const v = Math.round((i / (n - 1)) * 255);
      ctx.fillStyle = toColor(v);
      ctx.fillRect(a, y0, b - a, h);
    }
  }

  const gray = v => `rgb(${v},${v},${v})`;

  function bgBars(ctx, W, H) {
    const bars = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
    const top = Math.round(H * 2 / 3);
    bars.forEach((c, i) => {
      const a = Math.round((i * W) / bars.length);
      const b = Math.round(((i + 1) * W) / bars.length);
      ctx.fillStyle = c;
      ctx.fillRect(a, 0, b - a, top);
    });
    steps(ctx, 0, top, W, H - top, 11, gray);
  }

  function bgGray(ctx, W, H) {
    const half = Math.round(H / 2);
    ramp(ctx, 0, 0, W, half, gray);
    steps(ctx, 0, half, W, H - half, 16, gray);
  }

  function bgRgb(ctx, W, H) {
    const fns = [v => `rgb(${v},0,0)`, v => `rgb(0,${v},0)`, v => `rgb(0,0,${v})`, gray];
    fns.forEach((fn, i) => {
      const a = Math.round((i * H) / 4);
      const b = Math.round(((i + 1) * H) / 4);
      ramp(ctx, 0, a, W, b - a, fn);
    });
  }

  // ---------- overlays ----------
  function drawGrid(ctx, W, H, step) {
    ctx.fillStyle = 'rgba(160,160,160,0.75)';
    for (let x = 0; x < W; x += step) vline(ctx, x, 0, H, 1);
    for (let y = 0; y < H; y += step) hline(ctx, 0, y, W, 1);
    vline(ctx, W - 1, 0, H, 1);
    hline(ctx, 0, H - 1, W, 1);
  }

  function outlinedText(ctx, text, x, y, size) {
    ctx.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size / 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
  }

  function drawCabinets(ctx, s) {
    const { cabCols: cols, cabRows: rows, cabW: cw, cabH: ch } = s;
    // alternating tint so neighbouring cabinets are easy to tell apart
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2) ctx.fillRect(c * cw, r * ch, cw, ch);
      }
    }
    // both edges of every seam: last pixel of one cabinet + first of the next
    ctx.fillStyle = '#00c8ff';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * ch;
        hline(ctx, x, y, cw, 1);
        hline(ctx, x, y + ch - 1, cw, 1);
        vline(ctx, x, y, ch, 1);
        vline(ctx, x + cw - 1, y, ch, 1);
      }
    }
    // labels
    const size = Math.max(8, Math.floor(Math.min(cw, ch) * 0.2));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let n = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * cw + cw / 2, cy = r * ch + ch / 2;
        outlinedText(ctx, String(n++), cx, cy - size * 0.35, size);
        outlinedText(ctx, `C${c + 1} R${r + 1}`, cx, cy + size * 0.7, Math.max(7, Math.floor(size * 0.5)));
      }
    }
  }

  function drawCircles(ctx, W, H, lw) {
    const m = Math.min(W, H);
    const r = m * 0.12, pad = m * 0.03 + r;
    const circles = [[W / 2, H / 2, m * 0.45], [pad, pad, r], [W - pad, pad, r], [pad, H - pad, r], [W - pad, H - pad, r]];
    // dark halo under the white line so circles stay visible on white/yellow backgrounds
    [['rgba(0,0,0,0.85)', lw + 2], ['#ffffff', lw]].forEach(([color, width]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      circles.forEach(([x, y, rad]) => {
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.stroke();
      });
    });
  }

  function drawCross(ctx, W, H, lw) {
    ctx.strokeStyle = 'rgba(255,214,10,0.6)';
    ctx.lineWidth = Math.max(1, lw / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W, H);
    ctx.moveTo(W, 0); ctx.lineTo(0, H);
    ctx.stroke();
    ctx.fillStyle = '#ffd60a';
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    const t = lw;
    vline(ctx, cx - Math.floor(t / 2), 0, H, t);
    hline(ctx, 0, cy - Math.floor(t / 2), W, t);
  }

  function drawBorder(ctx, W, H) {
    const m = Math.min(W, H);
    ctx.fillStyle = '#ffffff';
    hline(ctx, 0, 0, W, 1); hline(ctx, 0, H - 1, W, 1);
    vline(ctx, 0, 0, H, 1); vline(ctx, W - 1, 0, H, 1);
    if (W > 2 && H > 2) {
      ctx.fillStyle = '#ff0000';
      hline(ctx, 1, 1, W - 2, 1); hline(ctx, 1, H - 2, W - 2, 1);
      vline(ctx, 1, 1, H - 2, 1); vline(ctx, W - 2, 1, H - 2, 1);
    }
    // corner triangles pointing into each corner
    const a = Math.max(6, Math.round(m * 0.06));
    ctx.fillStyle = '#ffffff';
    [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + a * dx, y);
      ctx.lineTo(x, y + a * dy);
      ctx.closePath();
      ctx.fill();
    });
  }

  function fitFont(ctx, text, maxW, size, weight) {
    let s = size;
    ctx.font = `${weight} ${s}px "Segoe UI", Arial, sans-serif`;
    const w = ctx.measureText(text).width;
    if (w > maxW) s = Math.max(6, Math.floor(s * (maxW / w)));
    return s;
  }

  function drawInfo(ctx, W, H, s) {
    const m = Math.min(W, H);
    const lines = [
      { text: `${W} × ${H}`, size: m * 0.14, weight: 800 },
      { text: `${aspect(W, H)}  ·  ${(W / H).toFixed(3)}:1  ·  ${(W * H / 1e6).toFixed(2)} MP`, size: m * 0.045, weight: 600 },
    ];
    if (s.cabOn) lines.push({ text: `${s.cabCols} × ${s.cabRows} cabinets @ ${s.cabW}×${s.cabH} px`, size: m * 0.045, weight: 600 });
    if (s.cabOn && s.panelInfo) lines.push({ text: s.panelInfo, size: m * 0.045, weight: 600 });
    if (s.event) lines.push({ text: s.event, size: m * 0.06, weight: 700 });
    if (s.screen) lines.push({ text: s.screen, size: m * 0.05, weight: 600 });

    const maxW = W * 0.8;
    lines.forEach(l => { l.size = fitFont(ctx, l.text, maxW, Math.max(6, Math.floor(l.size)), l.weight); });
    const gap = m * 0.015;
    const totalH = lines.reduce((t, l) => t + l.size * 1.2, 0) + gap * (lines.length - 1);
    let boxW = 0;
    lines.forEach(l => {
      ctx.font = `${l.weight} ${l.size}px "Segoe UI", Arial, sans-serif`;
      boxW = Math.max(boxW, ctx.measureText(l.text).width);
    });
    const padX = m * 0.04, padY = m * 0.03;
    const bw = Math.min(W, boxW + padX * 2), bh = Math.min(H, totalH + padY * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(Math.round((W - bw) / 2), Math.round((H - bh) / 2), Math.round(bw), Math.round(bh));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    let y = (H - totalH) / 2;
    lines.forEach(l => {
      ctx.font = `${l.weight} ${l.size}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(l.text, W / 2, y + l.size * 0.1);
      y += l.size * 1.2 + gap;
    });
  }

  function draw(ctx, W, H, s) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.direction = 'ltr';
    ctx.clearRect(0, 0, W, H);
    const lw = Math.max(1, Math.round(Math.min(W, H) / 540));

    switch (s.bg) {
      case 'solid': bgSolid(ctx, W, H, s.solid); break;
      case 'bars': bgBars(ctx, W, H); break;
      case 'gray': bgGray(ctx, W, H); break;
      case 'rgb': bgRgb(ctx, W, H); break;
      default: bgSolid(ctx, W, H, '#000000');
    }
    if (s.grid && s.gridStep >= 2) drawGrid(ctx, W, H, s.gridStep);
    if (s.cabOn && s.cabinets) drawCabinets(ctx, s);
    if (s.circles) drawCircles(ctx, W, H, lw);
    if (s.cross) drawCross(ctx, W, H, lw);
    if (s.border) drawBorder(ctx, W, H);
    if (s.info) drawInfo(ctx, W, H, s);
  }

  global.TestPattern = { draw, aspect };
})(window);
