// Reusable UI component builders.

// Create a labeled slider. Returns { el, getValue, setValue, onChange }.
export function makeSlider({ label, min, max, step, value, format, onChange }) {
  const container = document.createElement('div');
  container.className = 'control-row';

  const lbl = document.createElement('span');
  lbl.className = 'control-label';

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;

  const val = document.createElement('span');
  val.className = 'control-value';
  const fmt = format ?? (v => +parseFloat(v).toFixed(3));

  const update = () => {
    const v = parseFloat(input.value);
    lbl.textContent = label;
    val.textContent = fmt(v);
  };
  update();

  input.addEventListener('input', () => {
    update();
    onChange?.(parseFloat(input.value));
  });

  container.appendChild(lbl);
  container.appendChild(input);
  container.appendChild(val);

  return {
    el: container,
    getValue: () => parseFloat(input.value),
    setValue: v => { input.value = v; update(); },
    onChange: cb => input.addEventListener('input', () => cb(parseFloat(input.value))),
  };
}

// Create a button row.
export function makeButton(label, onClick) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.className = 'ctrl-btn';
  btn.addEventListener('click', onClick);
  return btn;
}

// Create a toggle checkbox. Returns { el, getValue, onChange }.
export function makeToggle({ label, checked = false, onChange }) {
  const container = document.createElement('label');
  container.className = 'control-toggle';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange?.(input.checked));

  container.appendChild(input);
  container.appendChild(document.createTextNode(' ' + label));

  return {
    el: container,
    getValue: () => input.checked,
    setValue: v => { input.checked = v; },
  };
}

// Create a 2×2 matrix input grid. Returns { el, getMatrix, setMatrix }.
export function makeMatrixInput({ label, initial, onChange }) {
  const container = document.createElement('div');
  container.className = 'matrix-input';
  if (label) {
    const h = document.createElement('div');
    h.className = 'matrix-label';
    h.textContent = label;
    container.appendChild(h);
  }

  const grid = document.createElement('div');
  grid.className = 'matrix-grid';

  const inputs = [];
  for (let i = 0; i < 2; i++) {
    inputs.push([]);
    for (let j = 0; j < 2; j++) {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '0.1';
      inp.value = initial?.[i]?.[j] ?? (i === j ? 1 : 0);
      inp.className = 'matrix-cell';
      inp.addEventListener('input', () => onChange?.(getMatrix()));
      grid.appendChild(inp);
      inputs[i].push(inp);
    }
  }

  container.appendChild(grid);

  const getMatrix = () => inputs.map(row => row.map(inp => parseFloat(inp.value) || 0));
  const setMatrix = M => {
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++)
        inputs[i][j].value = M[i][j].toFixed(3);
  };

  return { el: container, getMatrix, setMatrix };
}

// Create a color-coded optimizer visibility panel
export function makeOptimizerPanel(optimizers, onToggle) {
  const container = document.createElement('div');
  container.className = 'optimizer-panel';

  for (const opt of optimizers) {
    const row = document.createElement('label');
    row.className = 'optimizer-toggle';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => onToggle(opt.id, cb.checked));

    const dot = document.createElement('span');
    dot.className = 'optimizer-dot';
    dot.style.background = opt.color;

    row.appendChild(cb);
    row.appendChild(dot);
    row.appendChild(document.createTextNode(opt.label));
    container.appendChild(row);
  }

  return container;
}

// Create a section container with title
export function makeSectionContainer(id, title) {
  const section = document.createElement('section');
  section.id = id;
  section.className = 'viz-section';

  const h = document.createElement('h2');
  h.textContent = title;
  section.appendChild(h);

  return section;
}

// Create a split layout with canvas panel + controls panel
export function makeSplitLayout(canvasEl, controlsEl) {
  const wrap = document.createElement('div');
  wrap.className = 'split-layout';

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  canvasWrap.appendChild(canvasEl);

  const ctrlWrap = document.createElement('div');
  ctrlWrap.className = 'controls-wrap';
  ctrlWrap.appendChild(controlsEl);

  wrap.appendChild(canvasWrap);
  wrap.appendChild(ctrlWrap);
  return wrap;
}

// Group of buttons in a row
export function makeButtonRow(...buttons) {
  const row = document.createElement('div');
  row.className = 'button-row';
  for (const b of buttons) row.appendChild(b);
  return row;
}
