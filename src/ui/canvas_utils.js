// Shared canvas drawing utilities.

export function setupHiDPI(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

// --- Color ramps ---

// t ∈ [0,1]: 0=cool(blue), 0.5=neutral, 1=warm(red)
export function coolWarmRamp(t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const u = t * 2;
    return [
      Math.round(30 + u * 190),
      Math.round(60 + u * 160),
      Math.round(220 - u * 100),
    ];
  }
  const u = (t - 0.5) * 2;
  return [
    Math.round(220 + u * 35),
    Math.round(220 - u * 180),
    Math.round(120 - u * 100),
  ];
}

// Purple-teal ramp for a darker palette
export function purpleTealRamp(t) {
  t = Math.max(0, Math.min(1, t));
  return [
    Math.round(10 + t * 200),
    Math.round(10 + t * 80),
    Math.round(80 + t * 60),
  ];
}

// --- Coordinate transforms ---

// Returns a function (x, y) → [px, py] mapping world → canvas pixels.
// yRange: [yMin, yMax] with yMin at bottom of canvas.
export function makeTransform(xRange, yRange, W, H) {
  return (x, y) => [
    (x - xRange[0]) / (xRange[1] - xRange[0]) * W,
    H - (y - yRange[0]) / (yRange[1] - yRange[0]) * H,
  ];
}

export function makeInvTransform(xRange, yRange, W, H) {
  return (px, py) => [
    xRange[0] + (px / W) * (xRange[1] - xRange[0]),
    yRange[0] + ((H - py) / H) * (yRange[1] - yRange[0]),
  ];
}

// --- Axes ---

export function drawAxes(ctx, xRange, yRange, W, H, opts = {}) {
  const {
    axisColor = 'rgba(255,255,255,0.5)',
    tickColor = 'rgba(255,255,255,0.3)',
    labelColor = 'rgba(255,255,255,0.6)',
    fontSize = 11,
    ticks = 5,
  } = opts;

  const toP = makeTransform(xRange, yRange, W, H);
  ctx.save();
  ctx.strokeStyle = axisColor;
  ctx.fillStyle = labelColor;
  ctx.font = `${fontSize}px monospace`;
  ctx.lineWidth = 1;

  // x-axis
  if (yRange[0] <= 0 && yRange[1] >= 0) {
    const [, py] = toP(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(W, py);
    ctx.stroke();
  }
  // y-axis
  if (xRange[0] <= 0 && xRange[1] >= 0) {
    const [px] = toP(0, 0);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();
  }

  ctx.restore();
}

// --- Contour fill ---

// Draws a filled contour heatmap using ImageData (fast).
// Returns { minV, maxV } for use in contour line levels.
export function drawContourFill(ctx, lossF, xRange, yRange, W, H, colorRamp) {
  const imageData = ctx.createImageData(W, H);
  const vals = new Float32Array(W * H);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = xRange[0] + (px / W) * (xRange[1] - xRange[0]);
      const y = yRange[1] - (py / H) * (yRange[1] - yRange[0]);
      vals[py * W + px] = lossF(x, y);
    }
  }

  let minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] < minV) minV = vals[i];
    if (vals[i] > maxV) maxV = vals[i];
  }
  const range = maxV - minV || 1;

  for (let i = 0; i < vals.length; i++) {
    const t = (vals[i] - minV) / range;
    const [r, g, b] = colorRamp(t);
    const idx = i * 4;
    imageData.data[idx]     = r;
    imageData.data[idx + 1] = g;
    imageData.data[idx + 2] = b;
    imageData.data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return { minV, maxV };
}

// --- Iso-contour lines (marching squares) ---

export function drawContourLines(ctx, lossF, xRange, yRange, W, H, levels, color = 'rgba(255,255,255,0.25)') {
  const GW = 80, GH = 80;
  // Sample grid (GW+1) × (GH+1) values
  const grid = [];
  for (let j = 0; j <= GH; j++) {
    grid.push(new Float32Array(GW + 1));
    for (let i = 0; i <= GW; i++) {
      const x = xRange[0] + (i / GW) * (xRange[1] - xRange[0]);
      const y = yRange[1] - (j / GH) * (yRange[1] - yRange[0]);
      grid[j][i] = lossF(x, y);
    }
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;

  for (const level of levels) {
    ctx.beginPath();
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const vTL = grid[j][i],     vTR = grid[j][i + 1];
        const vBL = grid[j + 1][i], vBR = grid[j + 1][i + 1];
        const segs = marchingSquaresSegs(vTL, vTR, vBL, vBR, level);
        for (const [[lx0, ly0], [lx1, ly1]] of segs) {
          ctx.moveTo((i + lx0) / GW * W, (j + ly0) / GH * H);
          ctx.lineTo((i + lx1) / GW * W, (j + ly1) / GH * H);
        }
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Local cell coords: TL=(0,0) TR=(1,0) BL=(0,1) BR=(1,1) — canvas y-down.
function marchingSquaresSegs(vTL, vTR, vBL, vBR, level) {
  const tl = vTL > level ? 1 : 0;
  const tr = vTR > level ? 1 : 0;
  const bl = vBL > level ? 1 : 0;
  const br = vBR > level ? 1 : 0;
  const idx = (tl << 3) | (tr << 2) | (br << 1) | bl;
  if (idx === 0 || idx === 15) return [];

  const safe = (a, b) => Math.abs(b - a) < 1e-12 ? 0.5 : (level - a) / (b - a);
  const T  = [safe(vTL, vTR), 0];
  const R  = [1, safe(vTR, vBR)];
  const Bo = [safe(vBL, vBR), 1];
  const L  = [0, safe(vTL, vBL)];

  switch (idx) {
    case 1:  return [[L, Bo]];
    case 2:  return [[Bo, R]];
    case 3:  return [[L, R]];
    case 4:  return [[T, R]];
    case 5:  return [[T, R], [L, Bo]];
    case 6:  return [[T, Bo]];
    case 7:  return [[T, L]];
    case 8:  return [[T, L]];
    case 9:  return [[T, Bo]];
    case 10: return [[T, L], [R, Bo]];
    case 11: return [[T, R]];
    case 12: return [[L, R]];
    case 13: return [[Bo, R]];
    case 14: return [[L, Bo]];
    default: return [];
  }
}

// --- Drawing helpers ---

export function drawArrow(ctx, x0, y0, x1, y1, opts = {}) {
  const { color = '#fff', lineWidth = 1.5, headSize = 8 } = opts;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  // Arrowhead
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - headSize * Math.cos(angle - 0.4), y1 - headSize * Math.sin(angle - 0.4));
  ctx.lineTo(x1 - headSize * Math.cos(angle + 0.4), y1 - headSize * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawDot(ctx, px, py, radius, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function drawPolyline(ctx, points, color, lineWidth = 1.5) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
  ctx.restore();
}

// Draw a fading tail: points array in canvas coords, newest last.
export function drawFadingTail(ctx, points, color, maxTail = 20, lineWidth = 2) {
  const n = Math.min(points.length, maxTail);
  if (n < 2) return;
  const tail = points.slice(points.length - n);
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 1; i < tail.length; i++) {
    const alpha = i / tail.length;
    ctx.beginPath();
    ctx.moveTo(tail[i - 1][0], tail[i - 1][1]);
    ctx.lineTo(tail[i][0], tail[i][1]);
    ctx.strokeStyle = colorWithAlpha(color, alpha * 0.8);
    ctx.lineWidth = lineWidth * (0.4 + 0.6 * alpha);
    ctx.stroke();
  }
  ctx.restore();
}

function colorWithAlpha(cssColor, alpha) {
  if (cssColor.startsWith('#')) {
    const r = parseInt(cssColor.slice(1, 3), 16);
    const g = parseInt(cssColor.slice(3, 5), 16);
    const b = parseInt(cssColor.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
  }
  return cssColor.replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
}

// Draw a bar chart of values in [0, maxVal], with bars centered horizontally.
export function drawBarChart(ctx, values, maxVal, W, H, barColor = '#7c9ef8', labelColor = 'rgba(255,255,255,0.6)') {
  const n = values.length;
  if (n === 0) return;
  const margin = 10;
  const bw = (W - margin * 2) / n - 2;
  const bx0 = margin;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, W, H);

  // Target line at σ=1
  const targetY = H - margin - (1 / maxVal) * (H - margin * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, targetY);
  ctx.lineTo(W, targetY);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < n; i++) {
    const bh = Math.max(0, (values[i] / maxVal) * (H - margin * 2));
    const bx = bx0 + i * ((W - margin * 2) / n);
    const by = H - margin - bh;

    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.fill();
  }

  ctx.fillStyle = labelColor;
  ctx.font = '10px monospace';
  for (let i = 0; i < n; i++) {
    const bx = bx0 + i * ((W - margin * 2) / n) + bw / 2;
    ctx.fillText(values[i].toFixed(2), bx - 12, H - 2);
  }
  ctx.restore();
}

// Draw a simple log-scale line chart. series = [{data: [{x,y}], color, label}]
export function drawLogLineChart(ctx, series, W, H, xLabel = 'Iteration', yLabel = 'Error') {
  const margin = { top: 10, right: 10, bottom: 35, left: 50 };
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, W, H);

  // Find ranges
  let maxX = 0, minY = Infinity, maxY = -Infinity;
  for (const s of series) {
    for (const p of s.data) {
      if (p.x > maxX) maxX = p.x;
      if (p.y > 0) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }
  if (minY === Infinity) { ctx.restore(); return; }
  const logMin = Math.floor(Math.log10(minY)) - 1;
  const logMax = Math.ceil(Math.log10(maxY)) + 1;

  const toP = (x, y) => [
    margin.left + (x / maxX) * iW,
    margin.top + (1 - (Math.log10(Math.max(y, 1e-20)) - logMin) / (logMax - logMin)) * iH,
  ];

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.5;
  for (let exp = logMin; exp <= logMax; exp++) {
    const [, py] = toP(0, Math.pow(10, exp));
    ctx.beginPath();
    ctx.moveTo(margin.left, py);
    ctx.lineTo(margin.left + iW, py);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px monospace';
    ctx.fillText(`1e${exp}`, 2, py + 4);
  }

  // Axes labels
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px monospace';
  ctx.fillText(xLabel, margin.left + iW / 2 - 20, H - 5);

  // Series
  for (const s of series) {
    if (s.data.length < 2) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let first = true;
    for (const p of s.data) {
      if (p.y <= 0) continue;
      const [px, py] = toP(p.x, p.y);
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Legend
  let lx = margin.left + 4;
  for (const s of series) {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, margin.top + 4, 12, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '9px monospace';
    ctx.fillText(s.label, lx + 15, margin.top + 10);
    lx += 70;
  }

  ctx.restore();
}
