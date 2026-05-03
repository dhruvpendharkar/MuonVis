// Section 2: Newton-Schulz iteration — cobweb diagram + SV bar chart + convergence plot.

import { setupHiDPI, drawArrow, makeTransform, drawBarChart, drawLogLineChart } from '../ui/canvas_utils.js';
import { makeSlider, makeButton, makeButtonRow, makeToggle } from '../ui/controls.js';
import { nsStepScalar, nsRunScalarAll, nsRun, nsRunCubic } from '../math/newton_schulz.js';
import { singularValues } from '../math/svd.js';
import { zeros } from '../math/linalg.js';

const COBWEB_SIZE = 300;
const BAR_SIZE_W = 240;
const BAR_SIZE_H = 180;
const CONV_W = 560;
const CONV_H = 160;
const MAX_ITER = 12;

export default function initSection(container) {
  container.innerHTML = '';

  // --- State ---
  let matRank = 4;
  let condNum = 8;
  let nsIters = 0;
  let maxIters = MAX_ITER;
  let showCubic = true;
  let showLinear = true;
  let nsHistory = [];
  let nsHistoryCubic = [];
  let startSigma = 0.6;
  let dragging = false;
  let rafId = null;
  let playing = false;

  // --- Canvases ---
  const cobwebCanvas = document.createElement('canvas');
  const cobwebCtx = setupHiDPI(cobwebCanvas, COBWEB_SIZE, COBWEB_SIZE);

  const barCanvas = document.createElement('canvas');
  const barCtx = setupHiDPI(barCanvas, BAR_SIZE_W, BAR_SIZE_H);

  const convCanvas = document.createElement('canvas');
  const convCtx = setupHiDPI(convCanvas, CONV_W, CONV_H);

  // --- Build random matrix ---
  function buildMatrix(rank, cond) {
    const n = Math.min(rank, 6);
    // Build a random n×n matrix with prescribed singular values
    const sv = [];
    for (let i = 0; i < n; i++) sv.push(cond ** (-i / (n - 1 || 1)));
    // Random orthogonal matrices via Gram-Schmidt on random
    const U = randomOrtho(n);
    const V = randomOrtho(n);
    // A = U * diag(sv) * V^T
    const A = zeros(n, n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++)
          A[i][j] += U[i][k] * sv[k] * V[j][k];
    return A;
  }

  function recompute() {
    const A = buildMatrix(matRank, condNum);
    nsHistory = nsRun(A, maxIters, singularValues);
    nsHistoryCubic = nsRunCubic(A, maxIters, singularValues);
  }

  recompute();

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'controls-wrap';

  const desc = document.createElement('p');
  desc.className = 'section-desc';
  desc.innerHTML =
    '<b>Cobweb diagram</b>: the function σ → σ(15/8 − 10/8σ² + 3/8σ⁴) drives any σ ∈ (0,√(5/3)) → 1 with quintic convergence. ' +
    'Drag the starting point. <b>Bar chart</b>: singular values of a random matrix after each NS step.';
  controls.appendChild(desc);

  const rankSlider = makeSlider({
    label: 'Matrix rank', min: 2, max: 6, step: 1, value: matRank,
    format: v => Math.round(v),
    onChange: v => { matRank = Math.round(v); nsIters = 0; playing = false; recompute(); draw(); },
  });
  controls.appendChild(rankSlider.el);

  const condSlider = makeSlider({
    label: 'Condition number', min: 1, max: 20, step: 0.5, value: condNum,
    format: v => v.toFixed(1),
    onChange: v => { condNum = v; nsIters = 0; playing = false; recompute(); draw(); },
  });
  controls.appendChild(condSlider.el);

  const stepBtn   = makeButton('Step', () => { if (nsIters < maxIters) { nsIters++; draw(); } });
  const runBtn    = makeButton('Run', startPlay);
  const resetBtn  = makeButton('Reset', () => { nsIters = 0; playing = false; if (rafId) cancelAnimationFrame(rafId); draw(); });
  controls.appendChild(makeButtonRow(stepBtn, runBtn, resetBtn));

  const cubicToggle = makeToggle({ label: 'Show cubic', checked: true, onChange: v => { showCubic = v; draw(); } });
  const linearToggle = makeToggle({ label: 'Show linear', checked: true, onChange: v => { showLinear = v; draw(); } });
  controls.appendChild(cubicToggle.el);
  controls.appendChild(linearToggle.el);

  // --- Layout ---
  const top = document.createElement('div');
  top.className = 'ns-top-row';
  top.appendChild(cobwebCanvas);
  top.appendChild(barCanvas);

  const wrap = document.createElement('div');
  wrap.className = 'ns-wrap';
  wrap.appendChild(top);
  wrap.appendChild(convCanvas);

  const layout = document.createElement('div');
  layout.className = 'split-layout';
  const vw = document.createElement('div'); vw.className = 'canvas-wrap'; vw.appendChild(wrap);
  layout.appendChild(vw);
  layout.appendChild(controls);
  container.appendChild(layout);

  // --- Cobweb drag ---
  cobwebCanvas.style.cursor = 'crosshair';
  cobwebCanvas.addEventListener('mousedown', e => { dragging = true; handleDrag(e); });
  cobwebCanvas.addEventListener('mousemove', e => { if (dragging) handleDrag(e); });
  cobwebCanvas.addEventListener('mouseup', () => { dragging = false; });
  cobwebCanvas.addEventListener('mouseleave', () => { dragging = false; });

  const cobwebInv = makeTransform([0, 2], [0, 2], COBWEB_SIZE, COBWEB_SIZE);
  function handleDrag(e) {
    const rect = cobwebCanvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Inverse: x = (px/W)*(xMax-xMin) + xMin
    const sigma = (px / COBWEB_SIZE) * 2;
    startSigma = Math.max(0.01, Math.min(1.9, sigma));
    draw();
  }

  // --- Draw ---
  function draw() {
    drawCobweb();
    drawBars();
    drawConv();
  }

  function drawCobweb() {
    const W = COBWEB_SIZE, H = COBWEB_SIZE;
    cobwebCtx.clearRect(0, 0, W, H);
    cobwebCtx.fillStyle = 'var(--bg-section)';
    cobwebCtx.fillRect(0, 0, W, H);

    const toP = makeTransform([0, 2], [0, 2], W, H);

    // Grid + axes
    cobwebCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    cobwebCtx.lineWidth = 0.5;
    for (let v = 0; v <= 2; v += 0.5) {
      cobwebCtx.beginPath();
      cobwebCtx.moveTo(toP(v, 0)[0], toP(v, 0)[1]);
      cobwebCtx.lineTo(toP(v, 2)[0], toP(v, 2)[1]);
      cobwebCtx.stroke();
      cobwebCtx.beginPath();
      cobwebCtx.moveTo(toP(0, v)[0], toP(0, v)[1]);
      cobwebCtx.lineTo(toP(2, v)[0], toP(2, v)[1]);
      cobwebCtx.stroke();
    }

    // y = x identity line
    cobwebCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    cobwebCtx.lineWidth = 1;
    cobwebCtx.setLineDash([4, 4]);
    cobwebCtx.beginPath();
    cobwebCtx.moveTo(...toP(0, 0)); cobwebCtx.lineTo(...toP(2, 2));
    cobwebCtx.stroke();
    cobwebCtx.setLineDash([]);

    // Fixed point
    cobwebCtx.strokeStyle = 'rgba(255,255,255,0.2)';
    cobwebCtx.lineWidth = 0.5;
    cobwebCtx.setLineDash([2, 4]);
    cobwebCtx.beginPath();
    cobwebCtx.moveTo(...toP(1, 0)); cobwebCtx.lineTo(...toP(1, 1));
    cobwebCtx.moveTo(...toP(0, 1)); cobwebCtx.lineTo(...toP(1, 1));
    cobwebCtx.stroke();
    cobwebCtx.setLineDash([]);

    // f(σ) quintic curve
    cobwebCtx.strokeStyle = '#a29bfe';
    cobwebCtx.lineWidth = 2;
    cobwebCtx.beginPath();
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * 2;
      const fs = nsStepScalar(s);
      const [px, py] = toP(s, Math.min(fs, 2));
      i === 0 ? cobwebCtx.moveTo(px, py) : cobwebCtx.lineTo(px, py);
    }
    cobwebCtx.stroke();

    // Cobweb from startSigma
    let s = startSigma;
    cobwebCtx.strokeStyle = '#fd79a8';
    cobwebCtx.lineWidth = 1.2;
    cobwebCtx.beginPath();
    cobwebCtx.moveTo(...toP(s, 0));
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const fs = nsStepScalar(s);
      cobwebCtx.lineTo(...toP(s, Math.min(fs, 2)));
      cobwebCtx.lineTo(...toP(Math.min(fs, 2), Math.min(fs, 2)));
      s = fs;
      if (Math.abs(s - 1) < 1e-6) break;
    }
    cobwebCtx.stroke();

    // Starting dot
    cobwebCtx.fillStyle = '#fd79a8';
    cobwebCtx.beginPath();
    cobwebCtx.arc(...toP(startSigma, 0), 5, 0, Math.PI * 2);
    cobwebCtx.fill();

    // Label
    cobwebCtx.fillStyle = 'rgba(255,255,255,0.6)';
    cobwebCtx.font = '11px monospace';
    cobwebCtx.fillText('σ₀ = ' + startSigma.toFixed(2), 8, 16);
    cobwebCtx.fillStyle = '#a29bfe';
    cobwebCtx.fillText('f(σ) quintic', 8, 30);
  }

  function drawBars() {
    const entry = nsHistory[Math.min(nsIters, nsHistory.length - 1)];
    if (!entry) return;
    const svs = entry.singularValues;
    const maxSV = Math.max(...nsHistory[0].singularValues, 1.5);
    drawBarChart(barCtx, svs, maxSV, BAR_SIZE_W, BAR_SIZE_H);

    barCtx.fillStyle = 'rgba(255,255,255,0.7)';
    barCtx.font = '11px monospace';
    barCtx.fillText(`Iter ${nsIters}  err=${entry.error.toFixed(4)}`, 6, 14);
  }

  function drawConv() {
    const quinticData = nsHistory.map(e => ({ x: e.iter, y: e.error }));
    const cubicData   = nsHistoryCubic.map(e => ({ x: e.iter, y: e.error }));
    const series = [
      { data: quinticData, color: '#a29bfe', label: 'Quintic (NS)' },
    ];
    if (showCubic)  series.push({ data: cubicData,   color: '#55efc4', label: 'Cubic' });

    drawLogLineChart(convCtx, series, CONV_W, CONV_H, 'Iteration', 'Max |σ−1|');

    // Mark current iteration
    if (nsIters > 0 && nsHistory.length > 0) {
      const margin = { top: 10, left: 50 };
      const iW = CONV_W - margin.left - 10;
      const px = margin.left + (nsIters / maxIters) * iW;
      convCtx.save();
      convCtx.strokeStyle = 'rgba(255,255,255,0.5)';
      convCtx.lineWidth = 1;
      convCtx.setLineDash([3, 3]);
      convCtx.beginPath();
      convCtx.moveTo(px, 10); convCtx.lineTo(px, CONV_H - 35);
      convCtx.stroke();
      convCtx.setLineDash([]);
      convCtx.restore();
    }
  }

  function startPlay() {
    if (playing) return;
    playing = true;
    nsIters = 0;
    draw();
    function tick() {
      if (!playing || nsIters >= maxIters) { playing = false; return; }
      nsIters++;
      draw();
      rafId = setTimeout(tick, 300);
    }
    rafId = setTimeout(tick, 300);
  }

  draw();

  return () => {
    playing = false;
    if (rafId) clearTimeout(rafId);
  };
}

// --- Helpers ---

function randomOrtho(n) {
  // Random orthogonal matrix via QR decomposition of a random matrix
  const A = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => (Math.random() - 0.5) * 2)
  );
  return gramSchmidt(A);
}

function gramSchmidt(A) {
  const n = A.length;
  const Q = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let v = A.map(row => row[j]);
    for (let i = 0; i < j; i++) {
      const qi = Q.map(row => row[i]);
      const proj = dot(v, qi);
      v = v.map((x, k) => x - proj * qi[k]);
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    for (let i = 0; i < n; i++) Q[i][j] = norm > 1e-10 ? v[i] / norm : 0;
  }
  return Q;
}

function dot(u, v) { return u.reduce((s, x, i) => s + x * v[i], 0); }
