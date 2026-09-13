/**
 * DETECTION LAB — INTERACTIVE SENSING EXPERIMENT ENGINE
 * Physical Chamber Visualization & Deterministic Detection Logic
 * Course: 22EC711 · Professional Readiness for Innovation
 */

(function () {
  'use strict';

  // System State Model
  const labState = {
    env: 'LOS',             // 'LOS' | 'NLOS'
    obstacle: 'CLEAR',      // 'CLEAR' | 'BLOCKED'
    pathMode: 'BOTH',       // 'BOTH' | 'DIRECT' | 'RIS'
    directEnabled: true,
    risEnabled: true,
    phase: 180,             // 0 to 360 deg
    frequency: 10.00,       // 8.00 to 12.00 GHz
    activeScenario: 'open-space',
    testRunning: false,
    testTimer: null,
    testStep: 0
  };

  // Cached Elements
  const el = {
    // Status Bar
    statusIcon: document.getElementById('status-icon-display'),
    statusText: document.getElementById('status-text-display'),
    metricProp: document.getElementById('metric-propagation'),
    metricDiv: document.getElementById('metric-diversity'),
    metricEnv: document.getElementById('metric-environment'),

    // Chamber SVG Elements
    svgChamber: document.getElementById('det-chamber-svg'),
    obstacleGroup: document.getElementById('svg-obstacle-group'),
    directPathLine: document.getElementById('svg-direct-line'),
    risPath1: document.getElementById('svg-ris-path-1'),
    risPath2: document.getElementById('svg-ris-path-2'),
    risCellsGroup: document.getElementById('svg-ris-cells'),
    rxTargetField: document.getElementById('svg-rx-field'),
    pulsesContainer: document.getElementById('svg-pulses-container'),

    // Scenario Presets
    scenarioChips: document.querySelectorAll('.scenario-chip'),

    // Controls
    btnEnvLOS: document.getElementById('btn-env-los'),
    btnEnvNLOS: document.getElementById('btn-env-nlos'),
    btnObsClear: document.getElementById('btn-obs-clear'),
    btnObsBlocked: document.getElementById('btn-obs-blocked'),
    btnPathDirect: document.getElementById('btn-path-direct'),
    btnPathRIS: document.getElementById('btn-path-ris'),
    btnPathBoth: document.getElementById('btn-path-both'),

    // Rotary Phase Dial
    dialContainer: document.getElementById('det-dial-container'),
    dialPointer: document.getElementById('det-dial-pointer'),
    dialValDisp: document.getElementById('det-dial-val-disp'),
    phaseChips: document.querySelectorAll('.det-phase-chip'),

    // Frequency Tuner
    freqSlider: document.getElementById('det-freq-slider'),
    freqDisp: document.getElementById('det-freq-disp'),
    freqBtns: document.querySelectorAll('.det-freq-btn'),

    // Scope Monitors
    scopeDirect: document.getElementById('scope-direct-canvas'),
    scopeRIS: document.getElementById('scope-ris-canvas'),
    badgeCh1: document.getElementById('badge-ch1'),
    badgeCh2: document.getElementById('badge-ch2'),

    // System Flow Steps
    flowSteps: document.querySelectorAll('.flow-step-card'),

    // Event Log & Explanations
    eventLogTerminal: document.getElementById('event-log-terminal'),
    explainHeadline: document.getElementById('explain-headline'),
    explainText: document.getElementById('explain-text'),

    // Action Buttons
    btnRunTest: document.getElementById('btn-run-test'),
    btnResetExp: document.getElementById('btn-reset-exp')
  };

  /* =========================================================
     1. INITIALIZATION & BINDINGS
     ========================================================= */
  function initLab() {
    setupEventListeners();
    initChamberRISCells();
    initScopes();
    updateSystemState(true);
    startChamberAnimation();
    logEvent('System initialized in default configuration.', 'log-signal');
  }

  function setupEventListeners() {
    // Scenario Presets
    el.scenarioChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const scen = chip.getAttribute('data-scenario');
        applyScenario(scen);
      });
    });

    // Environment Buttons
    if (el.btnEnvLOS) el.btnEnvLOS.addEventListener('click', () => setEnvironment('LOS'));
    if (el.btnEnvNLOS) el.btnEnvNLOS.addEventListener('click', () => setEnvironment('NLOS'));

    // Obstacle Buttons
    if (el.btnObsClear) el.btnObsClear.addEventListener('click', () => setObstacle('CLEAR'));
    if (el.btnObsBlocked) el.btnObsBlocked.addEventListener('click', () => setObstacle('BLOCKED'));

    // Signal Path Mode Buttons
    if (el.btnPathDirect) el.btnPathDirect.addEventListener('click', () => setPathMode('DIRECT'));
    if (el.btnPathRIS) el.btnPathRIS.addEventListener('click', () => setPathMode('RIS'));
    if (el.btnPathBoth) el.btnPathBoth.addEventListener('click', () => setPathMode('BOTH'));

    // Frequency Slider & Presets
    if (el.freqSlider) {
      el.freqSlider.addEventListener('input', (e) => {
        setFrequency(parseFloat(e.target.value));
      });
    }
    el.freqBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setFrequency(parseFloat(btn.getAttribute('data-freq')));
      });
    });

    // Phase Dial
    initPhaseDial();

    // Run Test & Reset Experiment
    if (el.btnRunTest) el.btnRunTest.addEventListener('click', toggleAutomatedTest);
    if (el.btnResetExp) el.btnResetExp.addEventListener('click', resetExperiment);
  }

  /* =========================================================
     2. DETERMINISTIC DETECTION & STATE ENGINE
     ========================================================= */
  function updateSystemState(isInit = false) {
    // Determine path availabilities
    el.directEnabled = (labState.pathMode === 'DIRECT' || labState.pathMode === 'BOTH');
    el.risEnabled = (labState.pathMode === 'RIS' || labState.pathMode === 'BOTH');

    // Effective Direct Propagation (obstructed if obstacle is blocked OR environment is NLOS)
    const directPathObstructed = (labState.obstacle === 'BLOCKED' || labState.env === 'NLOS');
    const directPathActive = el.directEnabled && !directPathObstructed;
    const directPathBlocked = el.directEnabled && directPathObstructed;

    const risPathActive = el.risEnabled; // RIS path operates across NLOS via reflection

    // Compute Overall Detection Status
    let detectionState = 'CLEAR';
    let propagationText = 'DIRECT PATH AVAILABLE';
    let diversityText = 'SINGLE CHANNEL';
    let statusClass = 'state-clear';
    let statusIconText = '✓';

    if (!directPathActive && !risPathActive) {
      // Both disabled/unavailable
      detectionState = 'NO RELIABLE PATH';
      propagationText = 'PROPAGATION SEVERED';
      diversityText = 'NO CHANNEL';
      statusClass = 'state-none';
      statusIconText = '✕';
    } else if (directPathBlocked && !risPathActive) {
      // Direct path is physically blocked and RIS is not active
      detectionState = 'SIGNAL DEGRADED';
      propagationText = 'DIRECT OBSTRUCTED';
      diversityText = 'UNAVAILABLE';
      statusClass = 'state-degraded';
      statusIconText = '⚠';
    } else if (directPathBlocked && risPathActive) {
      // Direct blocked, but RIS provides reflected path
      detectionState = 'OBSTACLE DETECTED';
      propagationText = 'RIS-ASSISTED REFLECTION';
      diversityText = 'RIS CHANNEL';
      statusClass = 'state-detected';
      statusIconText = '▲';
    } else if (directPathActive && risPathActive) {
      // Both active
      if (labState.obstacle === 'BLOCKED') {
        detectionState = 'OBSTACLE DETECTED';
        propagationText = 'DUAL PATH ACTIVE';
        diversityText = 'SPATIAL DIVERSITY';
        statusClass = 'state-detected';
        statusIconText = '▲';
      } else {
        detectionState = 'CLEAR';
        propagationText = 'DIRECT & RIS AVAILABLE';
        diversityText = 'DUAL CHANNEL';
        statusClass = 'state-clear';
        statusIconText = '✓';
      }
    } else if (directPathActive && !risPathActive) {
      detectionState = 'CLEAR';
      propagationText = 'DIRECT PATH ONLY';
      diversityText = 'SINGLE CHANNEL';
      statusClass = 'state-clear';
      statusIconText = '✓';
    }

    // 1. Update Status Display
    if (el.statusText) {
      el.statusText.textContent = detectionState;
      el.statusText.className = `status-badge-val ${statusClass}`;
    }
    if (el.statusIcon) {
      el.statusIcon.textContent = statusIconText;
      el.statusIcon.style.color = statusClass === 'state-clear' ? 'var(--c-signal)' :
                                  statusClass === 'state-detected' ? 'var(--c-accent)' :
                                  statusClass === 'state-degraded' ? '#d4a017' : '#777';
    }
    if (el.metricProp) el.metricProp.textContent = propagationText;
    if (el.metricDiv) el.metricDiv.textContent = diversityText;
    if (el.metricEnv) el.metricEnv.textContent = `${labState.env} (${labState.obstacle})`;

    // 2. Update Chamber Visual Elements
    updateChamberVisuals(directPathActive, directPathBlocked, risPathActive);

    // 3. Update Scope Badges
    updateScopeBadges(directPathActive, directPathBlocked, risPathActive);

    // 4. Update System Pipeline Steps
    updateSystemPipeline(directPathActive, risPathActive, detectionState);

    // 5. Update Explanatory Text
    updateExplanatoryText(directPathActive, directPathBlocked, risPathActive, detectionState);

    // 6. Update Button Active States
    updateControlsUI();
  }

  /* =========================================================
     3. MAIN SVG CHAMBER VISUALIZATION
     ========================================================= */
  function initChamberRISCells() {
    if (!el.risCellsGroup) return;
    el.risCellsGroup.innerHTML = '';

    const cols = 8;
    const rows = 4;
    const cellW = 12;
    const cellH = 12;
    const gap = 3;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', c * (cellW + gap));
        rect.setAttribute('y', r * (cellH + gap));
        rect.setAttribute('width', cellW);
        rect.setAttribute('height', cellH);
        rect.setAttribute('fill', '#b3773f');
        rect.setAttribute('stroke', '#664422');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('class', 'chamber-ris-patch');
        el.risCellsGroup.appendChild(rect);
      }
    }
  }

  function updateChamberVisuals(directActive, directBlocked, risActive) {
    // 1. Obstacle Movement & Hatching
    if (el.obstacleGroup) {
      if (labState.obstacle === 'BLOCKED' || labState.env === 'NLOS') {
        // Move into direct path (y = 130)
        el.obstacleGroup.style.transform = 'translate(0px, 0px)';
        el.obstacleGroup.style.opacity = '1';
      } else {
        // Retract obstacle out of path (y = -120)
        el.obstacleGroup.style.transform = 'translate(0px, -140px)';
        el.obstacleGroup.style.opacity = '0.25';
      }
    }

    // 2. Direct Path Line Appearance
    if (el.directPathLine) {
      if (!el.directEnabled) {
        el.directPathLine.setAttribute('stroke', '#dcd8cf');
        el.directPathLine.setAttribute('stroke-dasharray', '4,4');
        el.directPathLine.setAttribute('opacity', '0.4');
      } else if (directBlocked) {
        el.directPathLine.setAttribute('stroke', 'var(--c-accent)');
        el.directPathLine.setAttribute('stroke-dasharray', '6,4');
        el.directPathLine.setAttribute('opacity', '0.75');
      } else {
        el.directPathLine.setAttribute('stroke', 'var(--c-direct)');
        el.directPathLine.removeAttribute('stroke-dasharray');
        el.directPathLine.setAttribute('opacity', '1');
      }
    }

    // 3. RIS Path Lines Appearance
    const risColor = risActive ? 'var(--c-ris)' : '#dcd8cf';
    const risOpacity = risActive ? '1' : '0.4';
    const risDash = risActive ? 'none' : '4,4';

    if (el.risPath1) {
      el.risPath1.setAttribute('stroke', risColor);
      el.risPath1.setAttribute('opacity', risOpacity);
      if (!risActive) el.risPath1.setAttribute('stroke-dasharray', risDash);
      else el.risPath1.removeAttribute('stroke-dasharray');
    }
    if (el.risPath2) {
      el.risPath2.setAttribute('stroke', risColor);
      el.risPath2.setAttribute('opacity', risOpacity);
      if (!risActive) el.risPath2.setAttribute('stroke-dasharray', risDash);
      else el.risPath2.removeAttribute('stroke-dasharray');
    }

    // 4. RIS Unit Cells Color / Tilt by Phase
    if (el.risCellsGroup) {
      const patches = el.risCellsGroup.querySelectorAll('.chamber-ris-patch');
      patches.forEach((p, idx) => {
        const col = idx % 8;
        const cellPhase = (labState.phase + col * 20) % 360;
        const fill = risActive
          ? (cellPhase > 180 ? '#d48844' : '#995a28')
          : '#443b32';
        p.setAttribute('fill', fill);
      });
    }

    // 5. RX Target Field Ring
    if (el.rxTargetField) {
      if (directActive || risActive) {
        el.rxTargetField.setAttribute('stroke', risActive && directBlocked ? 'var(--c-ris)' : 'var(--c-signal)');
        el.rxTargetField.setAttribute('opacity', '0.8');
      } else {
        el.rxTargetField.setAttribute('stroke', '#444');
        el.rxTargetField.setAttribute('opacity', '0.2');
      }
    }
  }

  /* --- 60fps Pulse Particle Animation --- */
  let pulseClock = 0;
  const directPulses = [0.0, 0.33, 0.66];
  const risPulses = [0.0, 0.25, 0.5, 0.75];

  function startChamberAnimation() {
    // Respect prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    function loop() {
      pulseClock += 0.008 * (labState.frequency / 10.0);
      renderPulses();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function renderPulses() {
    if (!el.pulsesContainer) return;
    el.pulsesContainer.innerHTML = '';

    // TX coordinate: (120, 160)
    // RX coordinate: (680, 160)
    // Obstacle bounds X: ~360 to 440, Y: ~100 to 220
    // RIS panel coordinate: (400, 360)

    const directPathObstructed = (labState.obstacle === 'BLOCKED' || labState.env === 'NLOS');

    // 1. Direct Signal Pulses (TX -> RX)
    if (el.directEnabled) {
      directPulses.forEach(offset => {
        const t = (pulseClock + offset) % 1.0;
        const currentX = 120 + t * (680 - 120);
        const currentY = 160;

        if (directPathObstructed && currentX > 370) {
          // Pulse hits the obstacle and dissipates
          if (currentX < 400) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', 370);
            circle.setAttribute('cy', 160);
            circle.setAttribute('r', (currentX - 370) * 0.4);
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', 'var(--c-accent)');
            circle.setAttribute('stroke-width', '1.5');
            circle.setAttribute('opacity', 1.0 - (currentX - 370) / 30);
            el.pulsesContainer.appendChild(circle);
          }
        } else {
          // Propagating pulse
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', currentX);
          circle.setAttribute('cy', currentY);
          circle.setAttribute('r', '4');
          circle.setAttribute('fill', 'var(--c-direct)');
          circle.setAttribute('filter', 'drop-shadow(0 0 4px #c94f2a)');
          el.pulsesContainer.appendChild(circle);
        }
      });
    }

    // 2. RIS Signal Pulses (TX -> RIS -> RX)
    if (el.risEnabled) {
      risPulses.forEach(offset => {
        const t = (pulseClock + offset) % 1.0;
        let px, py;
        if (t < 0.5) {
          // Segment 1: TX (120, 160) to RIS (400, 360)
          const segT = t / 0.5;
          px = 120 + segT * (400 - 120);
          py = 160 + segT * (360 - 160);
        } else {
          // Segment 2: RIS (400, 360) to RX (680, 160)
          const segT = (t - 0.5) / 0.5;
          px = 400 + segT * (680 - 400);
          py = 360 + segT * (160 - 360);
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', px);
        circle.setAttribute('cy', py);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', 'var(--c-ris)');
        circle.setAttribute('filter', 'drop-shadow(0 0 4px #3a7ebf)');
        el.pulsesContainer.appendChild(circle);
      });
    }
  }

  /* =========================================================
     4. ROTARY PHASE DIAL
     ========================================================= */
  let isDraggingDial = false;

  function initPhaseDial() {
    if (!el.dialContainer) return;

    el.dialContainer.addEventListener('pointerdown', (e) => {
      isDraggingDial = true;
      updateDialFromPointer(e);
    });
    window.addEventListener('pointermove', (e) => {
      if (isDraggingDial) updateDialFromPointer(e);
    });
    window.addEventListener('pointerup', () => { isDraggingDial = false; });

    el.phaseChips.forEach(chip => {
      chip.addEventListener('click', () => {
        setPhase(parseInt(chip.getAttribute('data-phase'), 10));
      });
    });

    updatePhaseUI();
  }

  function updateDialFromPointer(e) {
    const rect = el.dialContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    let angleRad = Math.atan2(dy, dx) + Math.PI / 2;
    if (angleRad < 0) angleRad += Math.PI * 2;
    let deg = Math.round((angleRad / (Math.PI * 2)) * 360);
    if (deg >= 360) deg = 0;

    setPhase(deg);
  }

  function setPhase(deg) {
    labState.phase = Math.max(0, Math.min(360, deg));
    updatePhaseUI();
    updateSystemState();
    logEvent(`RIS global reflection phase tuned to ${labState.phase}°`, 'log-ris');
  }

  function updatePhaseUI() {
    if (el.dialValDisp) el.dialValDisp.textContent = `${labState.phase}°`;
    if (el.dialPointer) {
      el.dialPointer.setAttribute('transform', `rotate(${labState.phase} 75 75)`);
    }
    el.phaseChips.forEach(c => {
      const val = parseInt(c.getAttribute('data-phase'), 10);
      c.classList.toggle('active', val === labState.phase);
    });
  }

  /* =========================================================
     5. ENVIRONMENT, OBSTACLE & FREQUENCY HANDLERS
     ========================================================= */
  function setEnvironment(env) {
    if (labState.env === env) return;
    labState.env = env;
    logEvent(`Environment set to ${env} mode.`, env === 'NLOS' ? 'log-accent' : 'log-signal');
    updateSystemState();
  }

  function setObstacle(obs) {
    if (labState.obstacle === obs) return;
    labState.obstacle = obs;
    logEvent(`Obstacle physical state changed &rarr; ${obs}`, obs === 'BLOCKED' ? 'log-accent' : 'log-signal');
    updateSystemState();
  }

  function setPathMode(mode) {
    if (labState.pathMode === mode) return;
    labState.pathMode = mode;
    logEvent(`Active transmission paths set to ${mode}`, 'log-ris');
    updateSystemState();
  }

  function setFrequency(f) {
    labState.frequency = Math.max(8.00, Math.min(12.00, f));
    if (el.freqSlider) el.freqSlider.value = labState.frequency.toFixed(2);
    if (el.freqDisp) el.freqDisp.textContent = `${labState.frequency.toFixed(2)} GHz`;
    el.freqBtns.forEach(b => {
      const val = parseFloat(b.getAttribute('data-freq'));
      b.classList.toggle('active', Math.abs(val - labState.frequency) < 0.05);
    });
    updateSystemState();
  }

  function updateControlsUI() {
    // Environment Buttons
    if (el.btnEnvLOS) el.btnEnvLOS.classList.toggle('active', labState.env === 'LOS');
    if (el.btnEnvNLOS) el.btnEnvNLOS.classList.toggle('active', labState.env === 'NLOS');

    // Obstacle Buttons
    if (el.btnObsClear) el.btnObsClear.classList.toggle('active', labState.obstacle === 'CLEAR');
    if (el.btnObsBlocked) el.btnObsBlocked.classList.toggle('active', labState.obstacle === 'BLOCKED');

    // Path Mode Buttons
    if (el.btnPathDirect) el.btnPathDirect.classList.toggle('active', labState.pathMode === 'DIRECT');
    if (el.btnPathRIS) el.btnPathRIS.classList.toggle('active', labState.pathMode === 'RIS');
    if (el.btnPathBoth) el.btnPathBoth.classList.toggle('active', labState.pathMode === 'BOTH');
  }

  /* =========================================================
     6. SCENARIO PRESETS
     ========================================================= */
  function applyScenario(scen) {
    labState.activeScenario = scen;
    el.scenarioChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-scenario') === scen));

    switch (scen) {
      case 'open-space':
        labState.env = 'LOS';
        labState.obstacle = 'CLEAR';
        labState.pathMode = 'BOTH';
        logEvent('Scenario loaded: OPEN SPACE (LOS, Obstacle Clear, Dual Paths)', 'log-signal');
        break;

      case 'blocked-path':
        labState.env = 'NLOS';
        labState.obstacle = 'BLOCKED';
        labState.pathMode = 'BOTH';
        logEvent('Scenario loaded: BLOCKED PATH (NLOS, Obstacle In-Path, RIS Assisted)', 'log-accent');
        break;

      case 'ris-only':
        labState.env = 'NLOS';
        labState.obstacle = 'BLOCKED';
        labState.pathMode = 'RIS';
        logEvent('Scenario loaded: RIS ONLY (Direct Channel Disabled, Pure Reflected Sensing)', 'log-ris');
        break;

      case 'dual-path':
        labState.env = 'LOS';
        labState.obstacle = 'BLOCKED';
        labState.pathMode = 'BOTH';
        logEvent('Scenario loaded: DUAL PATH (Simultaneous Direct + Reflected Diversity)', 'log-signal');
        break;

      case 'no-path':
        labState.env = 'NLOS';
        labState.obstacle = 'BLOCKED';
        labState.pathMode = 'DIRECT'; // Direct is blocked, so effectively no path
        logEvent('Scenario loaded: NO PATH (Direct Obstructed, RIS Disabled)', 'log-accent');
        break;
    }

    updateSystemState();
  }

  /* =========================================================
     7. TWO-CHANNEL OSCILLOSCOPE MONITOR
     ========================================================= */
  let scopeCtx1, scopeCtx2;
  let scopeClock = 0;

  function initScopes() {
    if (el.scopeDirect) scopeCtx1 = el.scopeDirect.getContext('2d');
    if (el.scopeRIS) scopeCtx2 = el.scopeRIS.getContext('2d');

    function drawScopes() {
      scopeClock += 0.08 * (labState.frequency / 10.0);
      const rootStyles = getComputedStyle(document.documentElement);
      const directColor = rootStyles.getPropertyValue('--c-direct').trim() || '#c94f2a';
      const risColor = rootStyles.getPropertyValue('--c-ris').trim() || '#3a7ebf';
      drawChannelWaveform(scopeCtx1, el.scopeDirect, el.directEnabled && labState.obstacle !== 'BLOCKED' && labState.env !== 'NLOS', directColor);
      drawChannelWaveform(scopeCtx2, el.scopeRIS, el.risEnabled, risColor);
      requestAnimationFrame(drawScopes);
    }
    requestAnimationFrame(drawScopes);
  }

  function drawChannelWaveform(ctx, canvas, isActive, color) {
    if (!ctx || !canvas) return;
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Scope grid and center reference.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += Math.max(28, w / 12)) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Waveform
    ctx.strokeStyle = isActive ? color : '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const amp = isActive ? (h * 0.35) : 1;
    const freq = (labState.frequency / 10.0) * 0.06;
    const phaseOffset = isActive ? (labState.phase * Math.PI / 180) : 0;

    for (let x = 0; x < w; x++) {
      const y = h / 2 + Math.sin(x * freq + scopeClock + phaseOffset) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function updateScopeBadges(directActive, directBlocked, risActive) {
    if (el.badgeCh1) {
      if (!el.directEnabled) {
        el.badgeCh1.textContent = 'MUTED';
        el.badgeCh1.className = 'ch-state-badge muted';
      } else if (directBlocked) {
        el.badgeCh1.textContent = 'BLOCKED (NLOS)';
        el.badgeCh1.className = 'ch-state-badge blocked';
      } else {
        el.badgeCh1.textContent = 'ACTIVE';
        el.badgeCh1.className = 'ch-state-badge active';
      }
    }

    if (el.badgeCh2) {
      if (risActive) {
        el.badgeCh2.textContent = 'ACTIVE (REFLECTING)';
        el.badgeCh2.className = 'ch-state-badge active';
      } else {
        el.badgeCh2.textContent = 'MUTED';
        el.badgeCh2.className = 'ch-state-badge muted';
      }
    }
  }

  /* =========================================================
     8. SYSTEM FLOW PIPELINE (01 - 06)
     ========================================================= */
  function updateSystemPipeline(directActive, risActive, detectionState) {
    if (!el.flowSteps || el.flowSteps.length < 6) return;

    // Step 01: Transmit (always active)
    setFlowStep(0, 'active', 'ACTIVE (TX1/TX2)');

    // Step 02: Propagate
    if (directActive && risActive) setFlowStep(1, 'active', 'DUAL CHANNELS');
    else if (directActive) setFlowStep(1, 'active', 'DIRECT LOS');
    else if (risActive) setFlowStep(1, 'active', 'RIS VECTOR');
    else setFlowStep(1, 'blocked', 'MUTED');

    // Step 03: Reflect (RIS)
    if (risActive) setFlowStep(2, 'active', `PHASE ${labState.phase}°`);
    else setFlowStep(2, 'blocked', 'DISABLED');

    // Step 04: Receive
    if (directActive || risActive) setFlowStep(3, 'active', 'SIGNAL CAPTURE');
    else setFlowStep(3, 'blocked', 'NO SIGNAL');

    // Step 05: Combine (Dual Antenna Processing)
    if (directActive && risActive) setFlowStep(4, 'active', 'SPATIAL DIVERSITY');
    else if (risActive) setFlowStep(4, 'active', 'RIS SINGLE CH');
    else if (directActive) setFlowStep(4, 'active', 'DIRECT SINGLE CH');
    else setFlowStep(4, 'blocked', 'INSUFFICIENT');

    // Step 06: Detect
    if (detectionState === 'OBSTACLE DETECTED') setFlowStep(5, 'blocked', 'OBSTACLE FLAG');
    else if (detectionState === 'CLEAR') setFlowStep(5, 'active', 'CLEAR PASS');
    else setFlowStep(5, 'blocked', 'DEGRADED');
  }

  function setFlowStep(index, statusClass, stateText) {
    const card = el.flowSteps[index];
    if (!card) return;
    card.className = `flow-step-card ${statusClass}`;
    const stEl = card.querySelector('.flow-step-state');
    if (stEl) stEl.textContent = stateText;
  }

  /* =========================================================
     9. DYNAMIC EXPLANATORY LOGIC
     ========================================================= */
  function updateExplanatoryText(directActive, directBlocked, risActive, detectionState) {
    if (!el.explainHeadline || !el.explainText) return;

    if (directBlocked && risActive) {
      el.explainHeadline.textContent = 'NLOS Obstacle Detection via RIS-Assisted Reflection';
      el.explainText.textContent =
        'The physical obstacle completely breaks the direct line-of-sight propagation path (Antenna 1). However, the metasurface (Antenna 2 channel) reconfigures the electromagnetic wave trajectory, steering a reflected sensing beam around the obstruction and enabling continuous obstacle detection.';
    } else if (directActive && risActive && labState.obstacle === 'CLEAR') {
      el.explainHeadline.textContent = 'Optimal Direct & Reflected Dual-Path Sensing';
      el.explainText.textContent =
        'The propagation chamber is clear of obstructions. Both Antenna 1 (Direct Path) and Antenna 2 (RIS-Reflected Path) concurrently observe the channel, providing maximum spatial signal diversity and robust baseline verification across the 8–12 GHz band.';
    } else if (!directActive && !risActive) {
      el.explainHeadline.textContent = 'No Reliable Propagation Channels Available';
      el.explainText.textContent =
        'Both direct and RIS propagation paths are currently disabled or blocked. Electromagnetic energy cannot reach the receiver antenna, resulting in a severed sensing link.';
    } else if (directBlocked && !risActive) {
      el.explainHeadline.textContent = 'Direct Path Obstructed — Conventional Radar Blind Spot';
      el.explainText.textContent =
        'This represents the fundamental failure mode of conventional single-antenna radars: when an obstacle enters the direct line of sight and no intelligent reflection surface is present, the sensing beam is completely blocked.';
    } else {
      el.explainHeadline.textContent = 'Direct Line-of-Sight Sensing Active';
      el.explainText.textContent =
        'The system is currently utilizing the direct propagation channel. Antenna 1 observes direct reflections while Antenna 2 RIS path is in standby.';
    }
  }

  /* =========================================================
     10. LIVE SIMULATION EVENT LOG
     ========================================================= */
  function logEvent(msg, typeClass = '') {
    if (!el.eventLogTerminal) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="${typeClass}">${msg}</span>`;

    el.eventLogTerminal.appendChild(line);
    el.eventLogTerminal.scrollTop = el.eventLogTerminal.scrollHeight;
  }

  /* =========================================================
     11. AUTOMATED 6-SECOND TEST SEQUENCE & RESET
     ========================================================= */
  function toggleAutomatedTest() {
    if (labState.testRunning) {
      stopAutomatedTest();
    } else {
      startAutomatedTest();
    }
  }

  function startAutomatedTest() {
    labState.testRunning = true;
    labState.testStep = 0;
    if (el.btnRunTest) {
      el.btnRunTest.classList.add('running');
      el.btnRunTest.dataset.step = '1';
      el.btnRunTest.innerHTML = '<span>⏹</span> Stop Test · 1/5';
    }

    logEvent('--- AUTOMATED EXPERIMENT SEQUENCE INITIATED ---', 'log-accent');

    const testStages = [
      () => {
        applyScenario('open-space');
        logEvent('Stage 1/5: Clear baseline calibration in LOS mode.', 'log-signal');
      },
      () => {
        logEvent('Stage 2/5: Transmitting 10.00 GHz continuous probing waveforms.', 'log-signal');
      },
      () => {
        setObstacle('BLOCKED');
        setEnvironment('NLOS');
        logEvent('Stage 3/5: Dynamic obstruction introduced. Direct path severed.', 'log-accent');
      },
      () => {
        setPhase(240);
        logEvent('Stage 4/5: RIS phase-gradient optimization & beam redirection.', 'log-ris');
      },
      () => {
        logEvent('Stage 5/5: Reflected signal captured at RX &rarr; OBSTACLE DETECTED.', 'log-accent');
      },
      () => {
        stopAutomatedTest();
        logEvent('--- AUTOMATED EXPERIMENT SEQUENCE COMPLETE ---', 'log-signal');
      }
    ];

    labState.testTimer = setInterval(() => {
      if (labState.testStep < testStages.length) {
        testStages[labState.testStep]();
        labState.testStep++;
        if (el.btnRunTest && labState.testStep <= 5) {
          el.btnRunTest.dataset.step = String(labState.testStep + 1);
          el.btnRunTest.innerHTML = `<span>⏹</span> Stop Test · ${labState.testStep + 1}/5`;
        }
      } else {
        stopAutomatedTest();
      }
    }, 1200);
  }

  function stopAutomatedTest() {
    labState.testRunning = false;
    clearInterval(labState.testTimer);
    if (el.btnRunTest) {
      el.btnRunTest.classList.remove('running');
      delete el.btnRunTest.dataset.step;
      el.btnRunTest.innerHTML = '<span>▶</span> Run Automated Test';
    }
  }

  function resetExperiment() {
    stopAutomatedTest();
    labState.env = 'LOS';
    labState.obstacle = 'CLEAR';
    labState.pathMode = 'BOTH';
    labState.phase = 180;
    labState.frequency = 10.00;
    labState.activeScenario = 'open-space';

    if (el.freqSlider) el.freqSlider.value = '10.00';
    if (el.freqDisp) el.freqDisp.textContent = '10.00 GHz';
    updatePhaseUI();
    updateSystemState();

    if (el.eventLogTerminal) el.eventLogTerminal.innerHTML = '';
    logEvent('Experiment parameters reset to standard baseline.', 'log-signal');
  }

  // Self Initialization on DOM load
  document.addEventListener('DOMContentLoaded', initLab);

})();
