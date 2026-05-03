// Section 5: Full Muon Pipeline — animated step-by-step diagram.

import { setupHiDPI, drawBarChart, makeTransform } from '../ui/canvas_utils.js';
import { makeButton, makeButtonRow, makeToggle } from '../ui/controls.js';
import { nsStep } from '../math/newton_schulz.js';
import { singularValues } from '../math/svd.js';
import { frobNorm, scale } from '../math/linalg.js';

const STAGES = [
  {
    id: 'forward',
    title: 'Forward Pass',
    desc: 'Compute loss L = f(W, x)',
    icon: '⟹',
    color: '#74b9ff',
  },
  {
    id: 'backward',
    title: 'Backward Pass',
    desc: 'Compute gradient G = ∂L/∂W  (shape m×n)',
    icon: '∇',
    color: '#a29bfe',
  },
  {
    id: 'momentum',
    title: 'Nesterov Momentum',
    desc: 'G_nes = μ·G_prev + G',
    icon: 'μ',
    color: '#55efc4',
  },
  {
    id: 'ns',
    title: 'Newton-Schulz',
    desc: 'U = NS(G_nes)  →  all SVs → 1',
    icon: 'NS',
    color: '#fd79a8',
  },
  {
    id: 'update',
    title: 'Weight Update',
    desc: 'W ← W − lr · U',
    icon: '↓',
    color: '#fdcb6e',
  },
  {
    id: 'sgd',
    title: 'SGD (embed/head)',
    desc: 'Optional: SGD for embedding & output layers',
    icon: '◎',
    color: 'rgba(200,200,200,0.4)',
  },
];

const ADAM_STAGES = [
  { title: 'Forward Pass',   desc: 'Compute loss L', color: '#74b9ff' },
  { title: 'Backward Pass',  desc: 'Gradient G',     color: '#a29bfe' },
  { title: 'Moment Update',  desc: 'm ← β₁m + (1-β₁)g\nv ← β₂v + (1-β₂)g²', color: '#55efc4' },
  { title: 'Bias Correction', desc: 'm̂, v̂',          color: '#fd79a8' },
  { title: 'Weight Update',  desc: 'W ← W − lr·m̂/√v̂', color: '#fdcb6e' },
  { title: '',               desc: '',                color: 'transparent' },
];

export default function initSection(container) {
  container.innerHTML = '';

  let activeStage = -1;
  let showAdam = false;
  let nsAnimFrame = null;
  let nsHistory = [];
  let nsDisplayIter = 0;

  // Precompute NS history for visualization
  function recomputeNS() {
    const n = 4;
    // Build a random 4×4 matrix with varied singular values
    const svTarget = [2.5, 1.8, 1.1, 0.4];
    const A = buildDiagLike(n, svTarget);
    const norm = frobNorm(A);
    let X = scale(A, 1 / (norm + 1e-7));
    nsHistory = [];
    for (let i = 0; i <= 8; i++) {
      nsHistory.push({ iter: i, svs: singularValues(X) });
      if (i < 8) X = nsStep(X);
    }
    nsDisplayIter = 0;
  }

  recomputeNS();

  // --- NS mini-canvas ---
  const NS_W = 180, NS_H = 100;
  const nsCanvas = document.createElement('canvas');
  const nsCtx = setupHiDPI(nsCanvas, NS_W, NS_H);
  nsCanvas.className = 'ns-inline-canvas';

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'controls-wrap';

  const desc = document.createElement('p');
  desc.className = 'section-desc';
  desc.innerHTML =
    'The complete Muon optimizer pipeline. Click each stage to expand details. ' +
    'Toggle the Adam column to compare architectures side-by-side.';
  controls.appendChild(desc);

  const stepBtn  = makeButton('Next stage →', () => {
    activeStage = (activeStage + 1) % STAGES.length;
    render();
  });
  const resetBtn = makeButton('Reset', () => { activeStage = -1; render(); });
  const adamToggle = makeToggle({ label: 'Compare with Adam', checked: false, onChange: v => { showAdam = v; render(); } });
  controls.appendChild(makeButtonRow(stepBtn, resetBtn));
  controls.appendChild(adamToggle.el);

  // Layout
  const pipelineContainer = document.createElement('div');
  pipelineContainer.className = 'pipeline-container';

  const layout = document.createElement('div');
  layout.className = 'split-layout';
  const cw = document.createElement('div'); cw.className = 'canvas-wrap pipeline-wrap'; cw.appendChild(pipelineContainer);
  layout.appendChild(cw);
  layout.appendChild(controls);
  container.appendChild(layout);

  function render() {
    pipelineContainer.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'pipeline-grid' + (showAdam ? ' two-col' : '');
    pipelineContainer.appendChild(grid);

    // Header
    const muonHeader = document.createElement('div');
    muonHeader.className = 'pipeline-header';
    muonHeader.textContent = 'Muon';
    grid.appendChild(muonHeader);

    if (showAdam) {
      const adamHeader = document.createElement('div');
      adamHeader.className = 'pipeline-header adam-header';
      adamHeader.textContent = 'Adam';
      grid.appendChild(adamHeader);
    }

    // Stages
    for (let i = 0; i < STAGES.length; i++) {
      const s = STAGES[i];
      const isActive = activeStage === i;

      const card = document.createElement('div');
      card.className = 'pipeline-stage' + (isActive ? ' active' : '') + (i < activeStage ? ' done' : '');
      card.style.borderColor = s.color;
      card.addEventListener('click', () => { activeStage = activeStage === i ? -1 : i; render(); });

      const icon = document.createElement('div');
      icon.className = 'stage-icon';
      icon.style.background = s.color + '33';
      icon.style.color = s.color;
      icon.textContent = s.icon;

      const text = document.createElement('div');
      text.className = 'stage-text';

      const title = document.createElement('div');
      title.className = 'stage-title';
      title.textContent = s.title;

      const descEl = document.createElement('div');
      descEl.className = 'stage-desc';
      descEl.textContent = s.desc;

      text.appendChild(title);
      text.appendChild(descEl);
      card.appendChild(icon);
      card.appendChild(text);

      // Inline NS detail panel
      if (isActive && s.id === 'ns') {
        const detail = document.createElement('div');
        detail.className = 'stage-detail';
        detail.appendChild(nsCanvas);
        drawNSBars();

        const nsStepBtn = makeButton('NS step', () => {
          if (nsDisplayIter < nsHistory.length - 1) {
            nsDisplayIter++;
            drawNSBars();
          }
        });
        const nsResetBtn = makeButton('Reset', () => { nsDisplayIter = 0; drawNSBars(); });
        detail.appendChild(makeButtonRow(nsStepBtn, nsResetBtn));
        card.appendChild(detail);
      }

      // Arrow between stages
      if (i < STAGES.length - 1) {
        const arrow = document.createElement('div');
        arrow.className = 'pipeline-arrow';
        arrow.textContent = i === STAGES.length - 2 ? '⋯' : '↓';
        card.appendChild(arrow);
      }

      grid.appendChild(card);

      // Adam column
      if (showAdam) {
        const as = ADAM_STAGES[i];
        const adamCard = document.createElement('div');
        adamCard.className = 'pipeline-stage adam-stage' + (isActive ? ' active' : '');
        adamCard.style.borderColor = as.color;

        const aText = document.createElement('div');
        aText.className = 'stage-text';
        const aTitle = document.createElement('div');
        aTitle.className = 'stage-title';
        aTitle.textContent = as.title;
        const aDesc = document.createElement('div');
        aDesc.className = 'stage-desc';
        aDesc.style.whiteSpace = 'pre-line';
        aDesc.textContent = as.desc;
        aText.appendChild(aTitle);
        aText.appendChild(aDesc);
        adamCard.appendChild(aText);
        grid.appendChild(adamCard);
      }
    }
  }

  function drawNSBars() {
    const entry = nsHistory[Math.min(nsDisplayIter, nsHistory.length - 1)];
    if (!entry) return;
    drawBarChart(nsCtx, entry.svs, 3, NS_W, NS_H - 15, '#fd79a8');
    nsCtx.fillStyle = 'rgba(255,255,255,0.7)';
    nsCtx.font = '10px monospace';
    nsCtx.fillText(`NS iter ${entry.iter}`, 4, NS_H - 3);
  }

  render();

  return () => {
    if (nsAnimFrame) cancelAnimationFrame(nsAnimFrame);
  };
}

// Build a matrix with approximately given singular values
function buildDiagLike(n, svs) {
  // Simple: diagonal matrix
  const A = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0);
    row[i] = svs[i] ?? 1;
    return row;
  });
  return A;
}
