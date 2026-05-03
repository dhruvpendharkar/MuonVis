// Section navigation with keyboard shortcuts and dot indicators.

export function initNav(sections, onNavigate) {
  let current = 0;

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { navigate(current + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { navigate(current - 1); e.preventDefault(); }
  });

  function navigate(idx) {
    idx = Math.max(0, Math.min(sections.length - 1, idx));
    if (idx === current) return;
    current = idx;
    onNavigate(current);
    updateIndicators();
  }

  // Build nav bar
  const nav = document.createElement('nav');
  nav.className = 'section-nav';

  const dots = sections.map((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'nav-dot' + (i === 0 ? ' active' : '');
    btn.title = s.title;
    btn.addEventListener('click', () => navigate(i));

    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = s.title;
    btn.appendChild(label);
    nav.appendChild(btn);
    return btn;
  });

  // Prev / Next arrows
  const prev = document.createElement('button');
  prev.textContent = '←';
  prev.className = 'nav-arrow nav-prev';
  prev.addEventListener('click', () => navigate(current - 1));

  const next = document.createElement('button');
  next.textContent = '→';
  next.className = 'nav-arrow nav-next';
  next.addEventListener('click', () => navigate(current + 1));

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.appendChild(prev);
  wrapper.appendChild(nav);
  wrapper.appendChild(next);

  function updateIndicators() {
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    prev.disabled = current === 0;
    next.disabled = current === sections.length - 1;
  }

  updateIndicators();
  return { el: wrapper, navigate, getCurrent: () => current };
}
