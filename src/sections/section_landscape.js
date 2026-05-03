// Section 4: Loss Landscape — GD vs Adam vs Muon on a 2D loss surface.

import {
  setupHiDPI, coolWarmRamp, drawContourFill, drawContourLines,
  drawArrow, drawDot, drawFadingTail, makeTransform, makeInvTransform,
} from '../ui/canvas_utils.js';
import { makeSlider, makeButton, makeButtonRow, makeToggle } from '../ui/controls.js';
import { gdStep, adamStep, muonStep, numericalGrad, initialState } from '../math/optimizers.js';

const W = 520, H = 420;
const XRANGE = [-3, 3];
const YRANGE = [-2.5, 2.5];

const OPTS = [
  { id: 'gd',   label: 'GD',   color: '#ff6b6b', step: gdStep },
  { id: 'adam', label: 'Adam', color: '#1dd1a1', step: adamStep },
  { id: 'muon', label: 'Muon', color: '#a29bfe', step: muonStep },
];

export default function initSection(container) {
  container.innerHTML = '';

  // --- Loss function parameters ---
  let lp = { a: 1, b: 10, c: 0.3, d: 3, e: 3 };
  const loss = (x, y) => 0.5 * (lp.a * x * x + lp.b * y * y) + lp.c * Math.sin(lp.d * x) * Math.cos(lp.e * y);

  // --- Optimizer state ---
  let lrs = { gd: 0.04, adam: 0.15, muon: 0.06 };
  let beta1 = 0.9, beta2 = 0.999;
  let nsIters = 5;
  let startPos = [-2, 1.5];
  let visible = { gd: true, adam: true, muon: true };
  let showGradArrows = false;
  let showUpdateArrows = false;

  let trails = {};
  let states = {};
  let playing = false;
  let rafId = null;

  function reset() {
    trails = {};
    states = {};
    for (const opt of OPTS) {
      trails[opt.id] = [worldToCanvas(startPos[0], startPos[1])];
      states[opt.id] = {
        params: [...startPos],
        optimState: initialState(opt.id, { beta1, beta2 }),
      };
    }
  }

  // --- Canvas ---
  const canvas = document.createElement('canvas');
  const ctx = setupHiDPI(canvas, W, H);
  canvas.style.cursor = 'crosshair';

  // Cached contour background
  let contourCache = null;

  function worldToCanvas(x, y) {
    const toP = makeTransform(XRANGE, YRANGE, W, H);
    return toP(x, y);
  }
  const invT = makeInvTransform(XRANGE, YRANGE, W, H);

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    startPos = invT(px, py);
    reset();
    if (!playing) draw();
  });

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'controls-wrap';

  const desc = document.createElement('p');
  desc.className = 'section-desc';
  desc.innerHTML =
    '<b>Click</b> the map to set start position. Watch GD oscillate, Adam adapt, Muon take clean steps. ' +
    'The loss: <i>L = ½(ax² + by²) + c·sin(dx)·cos(ey)</i>.';
  controls.appendChild(desc);

  // Optimizer toggles + LR sliders
  const optSection = document.createElement('div');
  optSection.className = 'opt-section';
  const lrSliders = {};
  for (const opt of OPTS) {
    const row = document.createElement('div');
    row.className = 'opt-row';

    const label = document.createElement('span');
    label.className = 'opt-label';
    label.style.color = opt.color;
    label.textContent = opt.label;

    const visCheck = document.createElement('input');
    visCheck.type = 'checkbox';
    visCheck.checked = true;
    visCheck.addEventListener('change', () => { visible[opt.id] = visCheck.checked; if (!playing) draw(); });

    const lrS = makeSlider({
      label: 'lr', min: 0.001, max: 0.3, step: 0.001, value: lrs[opt.id],
      format: v => v.toFixed(3),
      onChange: v => { lrs[opt.id] = v; },
    });
    lrSliders[opt.id] = lrS;

    row.appendChild(visCheck);
    row.appendChild(label);
    row.appendChild(lrS.el);
    optSection.appendChild(row);
  }
  controls.appendChild(optSection);

  // Landscape sliders
  const landscapeSection = document.createElement('details');
  landscapeSection.className = 'collapsible';
  const landscapeSummary = document.createElement('summary');
  landscapeSummary.textContent = 'Landscape parameters';
  landscapeSection.appendChild(landscapeSummary);

  function addLandscapeSlider(key, label, min, max, step, val) {
    const s = makeSlider({ label, min, max, step, value: val, onChange: v => {
      lp[key] = v;
      contourCache = null; // invalidate cache
      reset();
      if (!playing) draw();
    }});
    landscapeSection.appendChild(s.el);
  }
  addLandscapeSlider('a', 'a (x² weight)', 0.1, 5, 0.1, lp.a);
  addLandscapeSlider('b', 'b (y² weight)', 0.1, 20, 0.5, lp.b);
  addLandscapeSlider('c', 'c (ripple amp)', 0, 1, 0.05, lp.c);
  addLandscapeSlider('d', 'd (x freq)', 0.5, 8, 0.5, lp.d);
  addLandscapeSlider('e', 'e (y freq)', 0.5, 8, 0.5, lp.e);
  controls.appendChild(landscapeSection);

  // Adam params
  const adamSection = document.createElement('details');
  adamSection.className = 'collapsible';
  const adamSummary = document.createElement('summary');
  adamSummary.textContent = 'Adam params';
  adamSection.appendChild(adamSummary);
  const b1S = makeSlider({ label: 'β₁', min: 0, max: 0.999, step: 0.01, value: beta1, onChange: v => { beta1 = v; } });
  const b2S = makeSlider({ label: 'β₂', min: 0.9, max: 0.9999, step: 0.001, value: beta2, onChange: v => { beta2 = v; } });
  adamSection.appendChild(b1S.el);
  adamSection.appendChild(b2S.el);
  controls.appendChild(adamSection);

  // NS iters
  const nsS = makeSlider({ label: 'NS iters', min: 1, max: 10, step: 1, value: nsIters, format: v => Math.round(v), onChange: v => { nsIters = Math.round(v); } });
  controls.appendChild(nsS.el);

  // Arrow toggles
  const gradToggle   = makeToggle({ label: 'Show gradient arrows',  checked: false, onChange: v => { showGradArrows   = v; if (!playing) draw(); } });
  const updateToggle = makeToggle({ label: 'Show update arrows',    checked: false, onChange: v => { showUpdateArrows = v; if (!playing) draw(); } });
  controls.appendChild(gradToggle.el);
  controls.appendChild(updateToggle.el);

  // Step/Play/Reset buttons
  const stepBtn  = makeButton('Step',  doStep);
  const playBtn  = makeButton('Play',  startPlay);
  const resetBtn = makeButton('Reset', () => { playing = false; if (rafId) clearTimeout(rafId); reset(); draw(); });
  controls.appendChild(makeButtonRow(stepBtn, playBtn, resetBtn));

  const stepCounter = document.createElement('div');
  stepCounter.className = 'step-counter';
  controls.appendChild(stepCounter);

  // Layout
  const layout = document.createElement('div');
  layout.className = 'split-layout';
  const cw = document.createElement('div'); cw.className = 'canvas-wrap'; cw.appendChild(canvas);
  layout.appendChild(cw);
  layout.appendChild(controls);
  container.appendChild(layout);

  reset();

  // --- Rendering ---
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw contour background (cached)
    if (!contourCache) {
      const offscreen = document.createElement('canvas');
      offscreen.width = W;
      offscreen.height = H;
      const offCtx = offscreen.getContext('2d');
      const { minV, maxV } = drawContourFill(offCtx, loss, XRANGE, YRANGE, W, H, coolWarmRamp);
      // Contour lines at 8 levels
      const levels = [];
      for (let i = 1; i <= 8; i++) levels.push(minV + (maxV - minV) * (i / 9));
      drawContourLines(offCtx, loss, XRANGE, YRANGE, W, H, levels);
      contourCache = { canvas: offscreen, minV, maxV };
    }
    ctx.drawImage(contourCache.canvas, 0, 0);

    // Draw trails and current positions
    const toP = makeTransform(XRANGE, YRANGE, W, H);
    let step = 0;

    for (const opt of OPTS) {
      if (!visible[opt.id]) continue;
      const trail = trails[opt.id];
      if (!trail) continue;
      step = trail.length - 1;

      // Fading tail
      drawFadingTail(ctx, trail, opt.color, 20, 2);

      // Current position
      const cur = trail[trail.length - 1];
      drawDot(ctx, cur[0], cur[1], 5, opt.color);
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cur[0], cur[1], 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Arrows
      if ((showGradArrows || showUpdateArrows) && states[opt.id]) {
        const { params } = states[opt.id];
        const grad = numericalGrad(loss, params[0], params[1]);
        const [ox, oy] = toP(params[0], params[1]);

        if (showGradArrows) {
          const gscale = 8;
          const [gx, gy] = toP(params[0] - grad[0] * gscale, params[1] - grad[1] * gscale);
          drawArrow(ctx, ox, oy, gx, gy, { color: `${opt.color}88`, lineWidth: 1.5, headSize: 6 });
        }

        if (showUpdateArrows) {
          const lr = lrs[opt.id];
          let newParams;
          if (opt.id === 'gd') {
            newParams = [params[0] - lr * grad[0], params[1] - lr * grad[1]];
          } else if (opt.id === 'adam') {
            const r = adamStep(params, grad, states[opt.id].optimState, lr);
            newParams = r.params;
          } else {
            const r = muonStep(params, grad, states[opt.id].optimState, lr, nsIters);
            newParams = r.params;
          }
          const [ux, uy] = toP(newParams[0], newParams[1]);
          drawArrow(ctx, ox, oy, ux, uy, { color: opt.color, lineWidth: 2, headSize: 7 });
        }
      }
    }

    // Legend
    drawLegend();
    stepCounter.textContent = `Step: ${step}`;
  }

  function drawLegend() {
    ctx.save();
    let lx = 10, ly = H - 10;
    ctx.font = '11px monospace';
    for (const opt of OPTS) {
      if (!visible[opt.id]) continue;
      ctx.fillStyle = opt.color;
      ctx.fillRect(lx, ly - 8, 20, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(opt.label, lx + 24, ly);
      lx += 80;
    }
    ctx.restore();
  }

  function doStep() {
    const toP = makeTransform(XRANGE, YRANGE, W, H);
    for (const opt of OPTS) {
      if (!visible[opt.id]) continue;
      const { params, optimState } = states[opt.id];
      const grad = numericalGrad(loss, params[0], params[1]);
      const lr = lrs[opt.id];
      let result;
      if (opt.id === 'gd')   result = gdStep(params, grad, optimState, lr);
      else if (opt.id === 'adam') result = adamStep(params, grad, optimState, lr);
      else result = muonStep(params, grad, optimState, lr, nsIters);

      // Clamp to visible range
      const np = [
        Math.max(XRANGE[0], Math.min(XRANGE[1], result.params[0])),
        Math.max(YRANGE[0], Math.min(YRANGE[1], result.params[1])),
      ];
      states[opt.id] = { params: np, optimState: result.state };
      trails[opt.id].push(toP(np[0], np[1]));
    }
    draw();
  }

  function startPlay() {
    if (playing) return;
    playing = true;
    function tick() {
      if (!playing) return;
      doStep();
      rafId = setTimeout(tick, 120);
    }
    rafId = setTimeout(tick, 120);
  }

  draw();

  return () => {
    playing = false;
    if (rafId) clearTimeout(rafId);
  };
}
