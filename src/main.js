// App entry point — section routing and lifecycle management.

import { initNav } from './ui/nav.js';
import initPolar    from './sections/section_polar.js';
import initNS       from './sections/section_ns.js';
import initSVD      from './sections/section_svd.js';
import initLandscape from './sections/section_landscape.js';
import initPipeline  from './sections/section_pipeline.js';

const SECTIONS = [
  { id: 'polar',     title: '1. Polar Decomp',      init: initPolar },
  { id: 'ns',        title: '2. Newton-Schulz',      init: initNS },
  { id: 'svd',       title: '3. SVD Geometry',       init: initSVD },
  { id: 'landscape', title: '4. Loss Landscape',     init: initLandscape },
  { id: 'pipeline',  title: '5. Muon Pipeline',      init: initPipeline },
];

const app = document.getElementById('app');
const navMount = document.getElementById('nav-mount');

// One container per section; only the active one is visible
const sectionEls = SECTIONS.map(s => {
  const el = document.createElement('div');
  el.id = `section-${s.id}`;
  el.className = 'section-container hidden';
  el.dataset.title = s.title;
  app.appendChild(el);
  return el;
});

// Track currently active section's cleanup fn
let currentCleanup = null;
let currentIdx = -1;

function activate(idx) {
  if (idx === currentIdx) return;

  // Teardown previous
  if (currentCleanup) currentCleanup();
  currentCleanup = null;
  if (currentIdx >= 0) sectionEls[currentIdx].classList.add('hidden');

  currentIdx = idx;
  const el = sectionEls[idx];
  el.classList.remove('hidden');

  // Add section heading if not already present
  const s = SECTIONS[idx];
  currentCleanup = s.init(el);

  // Update page title
  document.title = `MuonVis · ${s.title}`;
}

// Build nav
const nav = initNav(SECTIONS, activate);
navMount.appendChild(nav.el);

// Start on first section
activate(0);
