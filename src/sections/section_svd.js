// Section 3: SVD Geometry — why gradient direction matters.

import { setupHiDPI, drawArrow, drawDot, makeTransform } from '../ui/canvas_utils.js';
import { makeSlider, makeButton, makeButtonRow, makeMatrixInput, makeToggle } from '../ui/controls.js';
import { svd2x2, polarFactor } from '../math/svd.js';
import { mul, transpose, scale, matVec } from '../math/linalg.js';

const CANVAS_SIZE = 380;
const RANGE = 3;
const GRID_LINES = 5;

export default function initSection(container) {
  container.innerHTML = '';

  let G = [[2, 0.5], [0.2, 0.8]];   // gradient matrix
  let condNum = 3;
  let showRaw = true;
  let showPolar = true;
  let condMode = false;  // when true, condNum slider morphs G

  // --- Canvas ---
  const canvas = document.createElement('canvas');
  const ctx = setupHiDPI(canvas, CANVAS_SIZE, CANVAS_SIZE);

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'controls-wrap';

  const desc = document.createElement('p');
  desc.className = 'section-desc';
  desc.innerHTML =
    'The gradient matrix <b>G</b> has large singular values in some directions (loud) and small in others (quiet). ' +
    'Raw GD steps <b>g</b> are dominated by the loud directions. ' +
    'The polar factor <b>UVᵀ</b> equalizes all directions.';
  controls.appendChild(desc);

  const matInput = makeMatrixInput({
    label: 'Gradient G',
    initial: G,
    onChange: M => { G = M; condMode = false; draw(); },
  });
  controls.appendChild(matInput.el);

  const condSlider = makeSlider({
    label: 'Condition number', min: 1, max: 15, step: 0.5, value: condNum,
    format: v => v.toFixed(1),
    onChange: v => {
      condNum = v;
      condMode = true;
      // Morph G: keep angle, vary condition
      const angle = 0.4;
      const c = Math.cos(angle), s = Math.sin(angle);
      const U = [[c, -s], [s, c]];
      const V = [[1, 0], [0, 1]];
      const sv1 = 1.5, sv2 = 1.5 / condNum;
      G = [
        [U[0][0]*sv1*V[0][0]+U[0][1]*sv2*V[1][0], U[0][0]*sv1*V[0][1]+U[0][1]*sv2*V[1][1]],
        [U[1][0]*sv1*V[0][0]+U[1][1]*sv2*V[1][0], U[1][0]*sv1*V[0][1]+U[1][1]*sv2*V[1][1]],
      ];
      matInput.setMatrix(G);
      draw();
    },
  });
  controls.appendChild(condSlider.el);

  const rawToggle   = makeToggle({ label: 'Show raw gradient step', checked: true, onChange: v => { showRaw = v; draw(); } });
  const polarToggle = makeToggle({ label: 'Show polar factor step', checked: true, onChange: v => { showPolar = v; draw(); } });
  controls.appendChild(rawToggle.el);
  controls.appendChild(polarToggle.el);

  const info = document.createElement('div');
  info.className = 'sv-info';
  controls.appendChild(info);

  // Layout
  const layout = document.createElement('div');
  layout.className = 'split-layout';
  const cw = document.createElement('div'); cw.className = 'canvas-wrap'; cw.appendChild(canvas);
  layout.appendChild(cw);
  layout.appendChild(controls);
  container.appendChild(layout);

  // --- Drawing ---
  const toP = makeTransform([-RANGE, RANGE], [-RANGE, RANGE], CANVAS_SIZE, CANVAS_SIZE);

  function draw() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Background
    ctx.fillStyle = 'var(--bg-section)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const { U, S, V } = svd2x2(G);

    // Draw input grid transformed by G
    drawGrid(G);

    // Draw singular value axes in output space
    const colors = ['#ff9f43', '#48dbfb'];
    for (let k = 0; k < 2; k++) {
      const [ox, oy] = toP(0, 0);
      const ax = U[0][k] * S[k], ay = U[1][k] * S[k];
      const [ex, ey] = toP(ax, ay);
      drawArrow(ctx, ox, oy, ex, ey, { color: colors[k], lineWidth: 2, headSize: 8 });
      ctx.save();
      ctx.fillStyle = colors[k];
      ctx.font = '11px monospace';
      ctx.fillText(`σ${k + 1}=${S[k].toFixed(2)}`, ex + 6, ey - 4);
      ctx.restore();
    }

    // Raw gradient column vector (first column of G as a step direction)
    const rawG = [G[0][0] + G[0][1], G[1][0] + G[1][1]];
    const rawNorm = Math.sqrt(rawG[0] ** 2 + rawG[1] ** 2);
    const rawDir = rawNorm > 1e-10 ? [rawG[0] / rawNorm, rawG[1] / rawNorm] : rawG;

    const P = polarFactor(G);
    const polDir = [P[0][0] + P[0][1], P[1][0] + P[1][1]];
    const polNorm = Math.sqrt(polDir[0] ** 2 + polDir[1] ** 2);
    const polDirN = polNorm > 1e-10 ? [polDir[0] / polNorm, polDir[1] / polNorm] : polDir;

    const [ox, oy] = toP(0, 0);
    const arrowScale = 1.5;
    if (showRaw) {
      const [rx, ry] = toP(rawDir[0] * arrowScale, rawDir[1] * arrowScale);
      drawArrow(ctx, ox, oy, rx, ry, { color: '#ff6b6b', lineWidth: 2.5, headSize: 10 });
      ctx.save();
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '12px monospace';
      ctx.fillText('raw g', rx + 5, ry);
      ctx.restore();
    }

    if (showPolar) {
      const [px, py] = toP(polDirN[0] * arrowScale, polDirN[1] * arrowScale);
      drawArrow(ctx, ox, oy, px, py, { color: '#a29bfe', lineWidth: 2.5, headSize: 10 });
      ctx.save();
      ctx.fillStyle = '#a29bfe';
      ctx.font = '12px monospace';
      ctx.fillText('UVᵀ', px + 5, py);
      ctx.restore();
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, toP(0, 0)[1]); ctx.lineTo(CANVAS_SIZE, toP(0, 0)[1]);
    ctx.moveTo(toP(0, 0)[0], 0); ctx.lineTo(toP(0, 0)[0], CANVAS_SIZE);
    ctx.stroke();

    info.innerHTML = `σ₁=${S[0].toFixed(3)}, σ₂=${S[1].toFixed(3)}, κ=${(S[0]/Math.max(S[1],1e-6)).toFixed(2)}`;
  }

  function drawGrid(M) {
    // Draw transformed grid lines to show how G distorts space
    ctx.save();
    ctx.strokeStyle = 'rgba(100,180,255,0.15)';
    ctx.lineWidth = 0.8;
    const N = 5;
    for (let i = -N; i <= N; i++) {
      // Horizontal line y=i/N*2 from x=-2 to x=2
      const x0 = -2, x1 = 2, y = i / N * 2;
      const [tx0, ty0] = transform(M, x0, y);
      const [tx1, ty1] = transform(M, x1, y);
      ctx.beginPath();
      ctx.moveTo(...toP(tx0, ty0)); ctx.lineTo(...toP(tx1, ty1));
      ctx.stroke();
      // Vertical line x=i/N*2 from y=-2 to y=2
      const x = i / N * 2, y0b = -2, y1b = 2;
      const [vx0, vy0] = transform(M, x, y0b);
      const [vx1, vy1] = transform(M, x, y1b);
      ctx.beginPath();
      ctx.moveTo(...toP(vx0, vy0)); ctx.lineTo(...toP(vx1, vy1));
      ctx.stroke();
    }
    ctx.restore();
  }

  function transform(M, x, y) {
    return [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
  }

  draw();
  return () => {};
}
