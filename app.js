/* =========================================================
   RIS-AIDED DUAL ANTENNA — SHARED APPLICATION SCRIPT
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------- */
(function initNav() {
  const header   = document.querySelector('.site-header');
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileMenu = document.querySelector('.nav-mobile');
  if (!header) return;

  // Mark active nav link
  const links = document.querySelectorAll('.nav-links a, .nav-mobile a');
  const current = window.location.pathname.split('/').pop() || 'index.html';
  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === current || (current === '' && href === 'index.html')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  // Mobile toggle
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open);
    });
    // Close on outside click
    document.addEventListener('click', e => {
      if (!header.contains(e.target) && !mobileMenu.contains(e.target)) {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Subtle scroll shadow
  window.addEventListener('scroll', () => {
    header.style.boxShadow = window.scrollY > 8
      ? '0 1px 12px rgba(0,0,0,0.08)'
      : '';
  }, { passive: true });
})();

/* ---------------------------------------------------------
   SCROLL REVEAL
   --------------------------------------------------------- */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ---------------------------------------------------------
   TABS
   --------------------------------------------------------- */
function initTabs(container) {
  const root = container || document;
  root.querySelectorAll('.tab-group').forEach(group => {
    const buttons = group.querySelectorAll('.tab-btn');
    const panelId = group.dataset.panels;
    const panelRoot = panelId ? document.getElementById(panelId) : group.nextElementSibling;

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        if (panelRoot) {
          panelRoot.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          const target = panelRoot.querySelector(`[data-tab="${btn.dataset.tab}"]`);
          if (target) target.classList.add('active');
        }
      });
    });
  });
}
initTabs();

/* ---------------------------------------------------------
   SIGNAL PATH ANIMATION (SVG)
   Used on index.html hero diagram
   --------------------------------------------------------- */
function animateDashOffset(el, from, to, duration, ease) {
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = ease ? ease(t) : t;
    el.style.strokeDashoffset = from + (to - from) * eased;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Pulse markers along an SVG path */
function createSignalPulse(svgEl, pathEl, color, duration, delay) {
  if (!svgEl || !pathEl) return;
  const totalLen = pathEl.getTotalLength();

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('r', '5');
  circle.setAttribute('fill', color);
  circle.setAttribute('opacity', '0');
  svgEl.appendChild(circle);

  let startTime = null;
  let animating = false;

  function loop(ts) {
    if (!animating) return;
    if (!startTime) startTime = ts + delay;
    const elapsed = ts - startTime;
    if (elapsed < 0) { requestAnimationFrame(loop); return; }

    const progress = (elapsed % duration) / duration;
    const pt = pathEl.getPointAtLength(progress * totalLen);
    circle.setAttribute('cx', pt.x);
    circle.setAttribute('cy', pt.y);
    circle.setAttribute('opacity', progress < 0.05 || progress > 0.95 ? '0' : '0.9');
    requestAnimationFrame(loop);
  }

  animating = true;
  requestAnimationFrame(loop);
  return () => { animating = false; circle.remove(); };
}

/* ---------------------------------------------------------
   CHART UTILITIES — simple SVG line plots
   --------------------------------------------------------- */
function buildLineChart(canvasEl, datasets, opts) {
  if (!canvasEl) return;
  const {
    width = 600, height = 300,
    xMin = 8, xMax = 12, yMin, yMax,
    xLabel = 'Frequency (GHz)', yLabel = '',
    grid = true, marker = null
  } = opts || {};

  // Compute y range automatically if not given
  const allY = datasets.flatMap(d => d.points.map(p => p[1]));
  const y0 = yMin !== undefined ? yMin : Math.min(...allY) - Math.abs(Math.min(...allY)) * 0.1;
  const y1 = yMax !== undefined ? yMax : Math.max(...allY) + Math.abs(Math.max(...allY)) * 0.1;

  const pad = { top: 20, right: 20, bottom: 48, left: 56 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  function toX(v) { return pad.left + ((v - xMin) / (xMax - xMin)) * W; }
  function toY(v) { return pad.top + ((y1 - v) / (y1 - y0)) * H; }

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Chart: ${xLabel}`);
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';

  // Background
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', width); bg.setAttribute('height', height);
  bg.setAttribute('fill', '#1a1917');
  svg.appendChild(bg);

  // Grid
  if (grid) {
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const val = y0 + (i / ySteps) * (y1 - y0);
      const cy = toY(val);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', pad.left); line.setAttribute('x2', pad.left + W);
      line.setAttribute('y1', cy); line.setAttribute('y2', cy);
      line.setAttribute('stroke', '#333230'); line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      // Y tick label
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', pad.left - 8); txt.setAttribute('y', cy + 4);
      txt.setAttribute('text-anchor', 'end');
      txt.setAttribute('font-family', 'JetBrains Mono, monospace');
      txt.setAttribute('font-size', '10');
      txt.setAttribute('fill', '#6b6865');
      txt.textContent = val.toFixed(0);
      svg.appendChild(txt);
    }

    const xSteps = 4;
    for (let i = 0; i <= xSteps; i++) {
      const val = xMin + (i / xSteps) * (xMax - xMin);
      const cx = toX(val);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', cx); line.setAttribute('x2', cx);
      line.setAttribute('y1', pad.top); line.setAttribute('y2', pad.top + H);
      line.setAttribute('stroke', '#2a2925'); line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', cx); txt.setAttribute('y', pad.top + H + 18);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', 'JetBrains Mono, monospace');
      txt.setAttribute('font-size', '10');
      txt.setAttribute('fill', '#6b6865');
      txt.textContent = val.toFixed(0) + ' GHz';
      svg.appendChild(txt);
    }
  }

  // Design-point marker
  if (marker !== null) {
    const mx = toX(marker);
    const ml = document.createElementNS(ns, 'line');
    ml.setAttribute('x1', mx); ml.setAttribute('x2', mx);
    ml.setAttribute('y1', pad.top); ml.setAttribute('y2', pad.top + H);
    ml.setAttribute('stroke', '#c94f2a'); ml.setAttribute('stroke-width', '1.5');
    ml.setAttribute('stroke-dasharray', '4 4');
    svg.appendChild(ml);

    const mt = document.createElementNS(ns, 'text');
    mt.setAttribute('x', mx + 5); mt.setAttribute('y', pad.top + 12);
    mt.setAttribute('font-family', 'JetBrains Mono, monospace');
    mt.setAttribute('font-size', '10');
    mt.setAttribute('fill', '#c94f2a');
    mt.textContent = marker + ' GHz';
    svg.appendChild(mt);
  }

  // Axes
  const axisColor = '#4a4845';
  const axisX = document.createElementNS(ns, 'line');
  axisX.setAttribute('x1', pad.left); axisX.setAttribute('x2', pad.left + W);
  axisX.setAttribute('y1', pad.top + H); axisX.setAttribute('y2', pad.top + H);
  axisX.setAttribute('stroke', axisColor); axisX.setAttribute('stroke-width', '1.5');
  svg.appendChild(axisX);

  const axisY = document.createElementNS(ns, 'line');
  axisY.setAttribute('x1', pad.left); axisY.setAttribute('x2', pad.left);
  axisY.setAttribute('y1', pad.top); axisY.setAttribute('y2', pad.top + H);
  axisY.setAttribute('stroke', axisColor); axisY.setAttribute('stroke-width', '1.5');
  svg.appendChild(axisY);

  // Axis labels
  const xLbl = document.createElementNS(ns, 'text');
  xLbl.setAttribute('x', pad.left + W / 2); xLbl.setAttribute('y', height - 6);
  xLbl.setAttribute('text-anchor', 'middle');
  xLbl.setAttribute('font-family', 'JetBrains Mono, monospace');
  xLbl.setAttribute('font-size', '11');
  xLbl.setAttribute('fill', '#6b6865');
  xLbl.textContent = xLabel;
  svg.appendChild(xLbl);

  const yLbl = document.createElementNS(ns, 'text');
  yLbl.setAttribute('transform', `rotate(-90, 12, ${pad.top + H / 2})`);
  yLbl.setAttribute('x', 12); yLbl.setAttribute('y', pad.top + H / 2);
  yLbl.setAttribute('text-anchor', 'middle');
  yLbl.setAttribute('font-family', 'JetBrains Mono, monospace');
  yLbl.setAttribute('font-size', '11');
  yLbl.setAttribute('fill', '#6b6865');
  yLbl.textContent = yLabel;
  svg.appendChild(yLbl);

  // Dataset lines
  datasets.forEach(ds => {
    const d = ds.points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${toX(p[0])},${toY(p[1])}`
    ).join(' ');

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', ds.color || '#c94f2a');
    path.setAttribute('stroke-width', ds.width || '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');

    // Animate draw
    const len = path.getTotalLength ? path.getTotalLength() : 800;
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.transition = `stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1) ${ds.delay || 0}ms`;
    svg.appendChild(path);

    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        path.style.strokeDashoffset = 0;
        io.disconnect();
      }
    });
    io.observe(canvasEl);

    // Legend
    if (ds.label) {
      const lx = toX(xMax) - 10;
      const ly = toY(ds.points[ds.points.length - 1][1]);
      const lt = document.createElementNS(ns, 'text');
      lt.setAttribute('x', lx - 4); lt.setAttribute('y', ly - 6);
      lt.setAttribute('text-anchor', 'end');
      lt.setAttribute('font-family', 'JetBrains Mono, monospace');
      lt.setAttribute('font-size', '10');
      lt.setAttribute('fill', ds.color || '#c94f2a');
      lt.textContent = ds.label;
      svg.appendChild(lt);
    }
  });

  // Disclaimer
  const disc = document.createElementNS(ns, 'text');
  disc.setAttribute('x', pad.left + W); disc.setAttribute('y', pad.top - 6);
  disc.setAttribute('text-anchor', 'end');
  disc.setAttribute('font-family', 'JetBrains Mono, monospace');
  disc.setAttribute('font-size', '9');
  disc.setAttribute('fill', '#4a4845');
  disc.textContent = 'ILLUSTRATIVE REFERENCE';
  svg.appendChild(disc);

  canvasEl.innerHTML = '';
  canvasEl.appendChild(svg);
}

/* ---------------------------------------------------------
   GENERATE S11 DATA (illustrative resonance at 10 GHz)
   --------------------------------------------------------- */
function genS11Data() {
  const pts = [];
  for (let f = 8; f <= 12; f += 0.05) {
    const center = 10, bw = 0.6;
    const depth = -35;
    const gauss = depth * Math.exp(-Math.pow((f - center) / (bw / 2), 2));
    const baseline = -2 - Math.sin((f - 8) * 0.8);
    pts.push([f, baseline + gauss]);
  }
  return pts;
}

function genS21Data() {
  const pts = [];
  for (let f = 8; f <= 12; f += 0.05) {
    const center = 10, bw = 0.7;
    const peak = -3;
    const gauss = peak * Math.exp(-Math.pow((f - center) / (bw / 2), 2));
    const baseline = -18 - Math.cos((f - 8) * 1.2) * 2;
    pts.push([f, baseline + gauss]);
  }
  return pts;
}

function genPhaseData() {
  const pts = [];
  for (let f = 8; f <= 12; f += 0.05) {
    const phase = 180 * Math.tanh((f - 10) / 0.4) + Math.sin((f - 8) * 3.5) * 12;
    pts.push([f, phase]);
  }
  return pts;
}

/* ---------------------------------------------------------
   EXPOSE GLOBALS
   --------------------------------------------------------- */
window.RIS = {
  buildLineChart,
  genS11Data,
  genS21Data,
  genPhaseData,
  createSignalPulse
};
