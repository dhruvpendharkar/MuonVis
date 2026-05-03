// Section 1: Polar Decomposition — W = U Σ Vᵀ animated decomposition.

import { setupHiDPI, drawArrow, drawDot, makeTransform } from '../ui/canvas_utils.js';
import { makeSlider, makeButton, makeButtonRow, makeMatrixInput } from '../ui/controls.js';
import { svd2x2 } from '../math/svd.js';
import { mul, transpose } from '../math/linalg.js';

const CANVAS_SIZE = 380;
const RANGE = 2.5;

export default function initSection(container) {
  container.innerHTML = '';

  // --- State ---
  let W = [[1.5, 0.5], [-0.3, 1.2]];
  let stage = 0; // 0=W applied, 1=Vᵀ, 2=Σ, 3=U (full decomp)
  let animFrame = null;
  let animT = 0;
  let animDir = 0; // +1 forward, -1 back

  // --- Canvas ---
  const canvas = document.createElement('canvas');
  const ctx = setupHiDPI(canvas, CANVAS_SIZE, CANVAS_SIZE);

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'controls-wrap';

  const desc = document.createElement('p');
  desc.className = 'section-desc';
  desc.innerHTML =
    'Apply matrix <b>W</b> to the unit circle. Then animate the SVD ' +
    '<b>W = U Σ Vᵀ</b> step-by-step: first rotate by <b>Vᵀ</b>, then scale by <b>Σ</b>, ' +
    'then rotate by <b>U</b>. The polar factor <b>UVᵀ</b> keeps all singular values = 1.';
  controls.appendChild(desc);

  const matInput = makeMatrixInput({
    label: 'Matrix W',
    initial: W,
    onChange: M => { W = M; stage = 0; draw(); },
  });
  controls.appendChild(matInput.el);

  const randBtn = makeButton('Randomize W', () => {
    W = [
      [rand(-2, 2), rand(-1, 1)],
      [rand(-1, 1), rand(-2, 2)],
    ];
    matInput.setMatrix(W);
    stage = 0;
    animT = 0;
    draw();
  });

  const stepBtn = makeButton('Step →', stepForward);
  const resetBtn = makeButton('Reset', () => { stage = 0; animT = 0; draw(); });
  controls.appendChild(makeButtonRow(randBtn, stepBtn, resetBtn));

  const stageLabel = document.createElement('div');
  stageLabel.className = 'stage-label';
  controls.appendChild(stageLabel);

  const svInfo = document.createElement('div');
  svInfo.className = 'sv-info';
  controls.appendChild(svInfo);

  // Layout
  const layout = document.createElement('div');
  layout.className = 'split-layout';
  const cw = document.createElement('div'); cw.className = 'canvas-wrap'; cw.appendChild(canvas);
  layout.appendChild(cw);
  layout.appendChild(controls);
  container.appendChild(layout);

  // --- Drawing ---
  const toP = makeTransform([-RANGE, RANGE], [-RANGE, RANGE], CANVAS_SIZE, CANVAS_SIZE);

  function getTransformAtStage(t) {
    // t ∈ [0, 3], interpolates through 4 stages
    const { U, S, V } = svd2x2(W);
    const Vt = transpose(V);

    // Stages:
    // 0→1: apply Vᵀ  (rotate input)
    // 1→2: apply Σ   (scale)
    // 2→3: apply U   (rotate output)

    const floor = Math.floor(t);
    const frac = t - floor;

    // Build intermediate matrix via interpolated log-space? Or just lerp SVD steps.
    // Simpler: build stage matrices and lerp elements
    const I2 = [[1, 0], [0, 1]];

    // Matrices for each stage boundary
    const M0 = I2;                                                       // identity
    const M1 = Vt;                                                       // after Vᵀ
    const M2 = mul([[S[0], 0], [0, S[1]]], Vt);                         // Σ Vᵀ
    const M3 = mul(mul(U, [[S[0], 0], [0, S[1]]]), Vt);                 // U Σ Vᵀ = W

    const stages = [M0, M1, M2, M3];
    const from = stages[Math.min(floor, 3)];
    const to   = stages[Math.min(floor + 1, 3)];

    return lerpMat(from, to, easeInOut(frac));
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawBg();

    const { U, S, V } = svd2x2(W);
    const M = getTransformAtStage(animT + stage);

    // Draw transformed unit circle
    drawEllipse(M, 'rgba(100,180,255,0.7)', 2);

    // Draw axes of ellipse after full W
    if (stage === 0 && animT < 0.01) {
      // Original unit circle — show it faintly
      drawCircle('rgba(255,255,255,0.15)', 1, 1);
    }

    // Axes of current ellipse (semi-axes in output space)
    const { U: Um, S: Sm } = svd2x2(M);
    drawSemiAxes(Um, Sm);

    // Polar factor circle (all SVs=1) — shown once full decomp is complete
    if (stage >= 3) {
      const P = mul(U, transpose(V));
      drawEllipse(P, 'rgba(180,120,255,0.5)', 1.5);
      ctx.save();
      ctx.fillStyle = '#a29bfe';
      ctx.font = '12px monospace';
      ctx.fillText('UVᵀ (polar factor)', toP(0.05, -RANGE + 0.25)[0], toP(0.05, -RANGE + 0.25)[1]);
      ctx.restore();
    }

    updateLabels(S);
    updateStageLabel();
  }

  function drawBg() {
    ctx.fillStyle = 'var(--bg-section)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let v = -2; v <= 2; v++) {
      const [vx] = toP(v, 0);
      ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, CANVAS_SIZE); ctx.stroke();
      const [, hy] = toP(0, v);
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(CANVAS_SIZE, hy); ctx.stroke();
    }
    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    const [cx, cy] = toP(0, 0);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(CANVAS_SIZE, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, CANVAS_SIZE); ctx.stroke();
  }

  function drawCircle(color, lineWidth, r = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const theta = (i / N) * 2 * Math.PI;
      const [px, py] = toP(r * Math.cos(theta), r * Math.sin(theta));
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawEllipse(M, color, lineWidth) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const theta = (i / N) * 2 * Math.PI;
      const vx = Math.cos(theta), vy = Math.sin(theta);
      const ox = M[0][0] * vx + M[0][1] * vy;
      const oy = M[1][0] * vx + M[1][1] * vy;
      const [px, py] = toP(ox, oy);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawSemiAxes(U, S) {
    const colors = ['#ff9f43', '#48dbfb'];
    for (let k = 0; k < 2; k++) {
      const scale = S[k];
      if (scale < 0.05) continue;
      const ux = U[0][k] * scale, uy = U[1][k] * scale;
      const [ox, oy] = toP(0, 0);
      const [ex, ey] = toP(ux, uy);
      drawArrow(ctx, ox, oy, ex, ey, { color: colors[k], lineWidth: 2, headSize: 7 });
      // Label
      ctx.save();
      ctx.fillStyle = colors[k];
      ctx.font = '12px monospace';
      ctx.fillText(`σ${k + 1}=${scale.toFixed(2)}`, ex + 5, ey - 5);
      ctx.restore();
    }
  }

  function updateLabels(S) {
    svInfo.innerHTML = `<b>σ₁</b> = ${S[0].toFixed(3)}&nbsp;&nbsp;<b>σ₂</b> = ${S[1].toFixed(3)}&nbsp;&nbsp;` +
      `<b>det</b> = ${(S[0] * S[1]).toFixed(3)}`;
  }

  const stageNames = [
    '0. Original: apply W to unit circle',
    '1. Rotate by Vᵀ (align to singular vectors)',
    '2. Scale by Σ (singular values)',
    '3. Rotate by U → W = UΣVᵀ complete',
  ];

  function updateStageLabel() {
    stageLabel.textContent = stageNames[Math.min(stage + (animT > 0.5 ? 1 : 0), 3)];
  }

  function stepForward() {
    if (stage >= 3) { stage = 0; animT = 0; draw(); return; }
    startAnim(1);
  }

  function startAnim(dir) {
    if (animFrame) return;
    animDir = dir;
    const startT = animT;
    const target = startT + dir;
    const startTime = performance.now();
    const duration = 600;

    function tick(now) {
      const frac = Math.min(1, (now - startTime) / duration);
      animT = startT + dir * frac;
      draw();
      if (frac < 1) {
        animFrame = requestAnimationFrame(tick);
      } else {
        animT = 0;
        stage = Math.min(stage + 1, 3);
        animFrame = null;
        draw();
      }
    }
    animFrame = requestAnimationFrame(tick);
  }

  draw();

  return () => {
    if (animFrame) cancelAnimationFrame(animFrame);
  };
}

// --- Helpers ---
function rand(a, b) { return a + Math.random() * (b - a); }

function lerpMat(A, B, t) {
  return A.map((row, i) => row.map((v, j) => v + (B[i][j] - v) * t));
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
