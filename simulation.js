/**
 * RIS SIMULATION WORKSTATION ENGINE
 * Precision RF Laboratory & CST-Inspired Electromagnetic Visualizer
 * Course: 22EC711 - Professional Readiness for Innovation
 */

(function () {
  'use strict';

  // State Management
  const simState = {
    frequency: 10.00,       // 8.00 to 12.00 GHz
    phase: 180,             // 0 to 360 deg
    selectedCell: { row: 3, col: 3, index: 27 },
    autoRotate: false,
    showGrid: true,
    showAxes: true,
    showField: true,
    waveAnimActive: true,
    freqSweepActive: false,
    phaseSweepActive: false,
    freqSweepTimer: null,
    phaseSweepTimer: null
  };

  // DOM Elements Cache
  const el = {
    canvasWrap: document.getElementById('sim-canvas-wrap'),
    threeCanvas: document.getElementById('sim-three-canvas'),
    fallbackBox: document.getElementById('sim-fallback-box'),
    
    // Telemetry
    teleState: document.getElementById('tele-state'),
    teleFreq: document.getElementById('tele-freq'),
    telePhase: document.getElementById('tele-phase'),
    
    // Frequency Controls
    freqSlider: document.getElementById('freq-slider'),
    freqReadout: document.getElementById('freq-readout'),
    freqChips: document.querySelectorAll('.freq-chip'),
    btnFreqSweep: document.getElementById('btn-freq-sweep'),
    
    // Phase Controls
    phaseDialContainer: document.getElementById('phase-dial-container'),
    phaseDegReadout: document.getElementById('phase-deg-readout'),
    phaseDialPointer: document.getElementById('phase-dial-pointer'),
    phaseDialArc: document.getElementById('phase-dial-arc'),
    phaseChips: document.querySelectorAll('.phase-chip'),
    btnPhaseSweep: document.getElementById('btn-phase-sweep'),
    
    // Viewport Tools
    btnResetView: document.getElementById('btn-reset-view'),
    btnAutoRotate: document.getElementById('btn-auto-rotate'),
    btnViewTop: document.getElementById('btn-view-top'),
    btnViewFront: document.getElementById('btn-view-front'),
    btnViewSide: document.getElementById('btn-view-side'),
    btnToggleGrid: document.getElementById('btn-toggle-grid'),
    btnToggleAxes: document.getElementById('btn-toggle-axes'),
    btnToggleField: document.getElementById('btn-toggle-field'),
    btnToggleAnim: document.getElementById('btn-toggle-anim'),
    
    // Inspection Panel
    inspectCellId: document.getElementById('inspect-cell-id'),
    inspectCellPhase: document.getElementById('inspect-cell-phase'),
    inspectCellEps: document.getElementById('inspect-cell-eps'),
    inspectCellPatch: document.getElementById('inspect-cell-patch'),
    
    // 2D Array
    arrayMatrix2D: document.getElementById('array-matrix-2d'),
    
    // Charts
    s11Canvas: document.getElementById('chart-s11'),
    s21Canvas: document.getElementById('chart-s21'),
    phaseChartCanvas: document.getElementById('chart-phase')
  };

  let scene, camera, renderer, controls;
  let risGroup, gridHelper, axesGroup, incidentWaveGroup, reflectedWaveGroup;
  let unitCellMeshes = [];
  let raycaster, mouse;
  let charts = {};

  // Check WebGL availability
  function hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  /* =========================================================
     1. THREE.JS 3D SCENE SETUP
     ========================================================= */
  function init3DScene() {
    if (!el.canvasWrap || !el.threeCanvas) return;
    if (!hasWebGL() || typeof THREE === 'undefined') {
      showFallbackView();
      return;
    }

    const width = el.canvasWrap.clientWidth || 800;
    const height = el.canvasWrap.clientHeight || 540;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a09);

    // Camera
    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(22, 18, 28);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: el.threeCanvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls fallback or OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxDistance = 80;
      controls.minDistance = 8;
      controls.target.set(0, 2, 0);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight1.position.set(20, 40, 25);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x88aacc, 0.5);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // Reference Ground Grid
    gridHelper = new THREE.GridHelper(40, 40, 0x333230, 0x1f1e1c);
    gridHelper.position.y = -4;
    scene.add(gridHelper);

    // Custom Coordinate Tripod
    createAxesTripod();

    // Procedural RIS Metasurface Assembly
    buildRISAssembly();

    // Wavefront & Propagation Paths
    buildWaveVisualizers();

    // Raycasting for Cell Selection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    el.threeCanvas.addEventListener('pointerdown', onCanvasPointerDown);

    // Resize Handler
    window.addEventListener('resize', onWindowResize);

    // Animation Loop
    animate3D();
  }

  /* --- Procedural Metasurface Geometry --- */
  function buildRISAssembly() {
    risGroup = new THREE.Group();
    risGroup.position.set(0, 2, 0);

    const rows = 8;
    const cols = 8;
    const period = 1.4;       // Visual scale corresponding to 10 mm
    const patchSize = 1.12;   // Visual scale corresponding to 8 mm
    const subThickness = 0.28; // Visual scale for 1.6 mm FR-4
    const totalW = cols * period;
    const totalH = rows * period;

    // 1. Substrate Slab (FR-4 Dielectric)
    const subGeo = new THREE.BoxGeometry(totalW + 0.6, subThickness, totalH + 0.6);
    const subMat = new THREE.MeshStandardMaterial({
      color: 0x2b3327, // FR-4 dark greenish-matte hue
      roughness: 0.65,
      metalness: 0.1
    });
    const substrateMesh = new THREE.Mesh(subGeo, subMat);
    substrateMesh.position.y = -subThickness / 2;
    substrateMesh.receiveShadow = true;
    risGroup.add(substrateMesh);

    // 2. Back Ground Plane (Copper Ground)
    const gndGeo = new THREE.BoxGeometry(totalW + 0.62, 0.02, totalH + 0.62);
    const gndMat = new THREE.MeshStandardMaterial({
      color: 0x8a5528,
      metalness: 0.85,
      roughness: 0.3
    });
    const gndMesh = new THREE.Mesh(gndGeo, gndMat);
    gndMesh.position.y = -subThickness - 0.01;
    risGroup.add(gndMesh);

    // 3. Copper Unit Cell Patches (8x8 Array)
    const patchGeo = new THREE.BoxGeometry(patchSize, 0.04, patchSize);
    
    // Patch materials
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xc98144, // Conductive copper
      metalness: 0.9,
      roughness: 0.25
    });

    unitCellMeshes = [];

    const startX = -((cols - 1) * period) / 2;
    const startZ = -((rows - 1) * period) / 2;

    let index = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const patch = new THREE.Mesh(patchGeo, copperMat.clone());
        patch.position.set(startX + c * period, 0.02, startZ + r * period);
        patch.castShadow = true;
        patch.receiveShadow = true;
        
        // Custom metadata for inspection
        patch.userData = {
          row: r + 1,
          col: c + 1,
          index: index,
          isUnitCell: true,
          baseColor: 0xc98144
        };

        risGroup.add(patch);
        unitCellMeshes.push(patch);
        index++;
      }
    }

    scene.add(risGroup);
    highlightSelectedCell(simState.selectedCell.index);
  }

  /* --- 3D Coordinate Tripod --- */
  function createAxesTripod() {
    axesGroup = new THREE.Group();
    axesGroup.position.set(-14, -3.8, 14);

    const axisLen = 3.5;
    const arrowRadius = 0.25;

    // X Axis (Red)
    const dirX = new THREE.Vector3(1, 0, 0);
    const arrowX = new THREE.ArrowHelper(dirX, new THREE.Vector3(0, 0, 0), axisLen, 0xc94f2a, 0.7, arrowRadius);
    axesGroup.add(arrowX);

    // Y Axis (Green / Normal to surface)
    const dirY = new THREE.Vector3(0, 1, 0);
    const arrowY = new THREE.ArrowHelper(dirY, new THREE.Vector3(0, 0, 0), axisLen, 0x4aab6d, 0.7, arrowRadius);
    axesGroup.add(arrowY);

    // Z Axis (Blue)
    const dirZ = new THREE.Vector3(0, 0, 1);
    const arrowZ = new THREE.ArrowHelper(dirZ, new THREE.Vector3(0, 0, 0), axisLen, 0x3a7ebf, 0.7, arrowRadius);
    axesGroup.add(arrowZ);

    scene.add(axesGroup);
  }

  /* --- Wavefront & Path Visualizers --- */
  function buildWaveVisualizers() {
    incidentWaveGroup = new THREE.Group();
    reflectedWaveGroup = new THREE.Group();

    // Source TX Marker
    const sourceGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const sourceMat = new THREE.MeshBasicMaterial({ color: 0xc94f2a });
    const sourceMesh = new THREE.Mesh(sourceGeo, sourceMat);
    sourceMesh.position.set(-12, 10, -10);
    scene.add(sourceMesh);

    // Source Label / Line
    const txLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-12, 10, -10),
      new THREE.Vector3(0, 2, 0)
    ]);
    const txLineMat = new THREE.LineDashedMaterial({
      color: 0xc94f2a,
      dashSize: 0.6,
      gapSize: 0.3,
      opacity: 0.7,
      transparent: true
    });
    const txLine = new THREE.Line(txLineGeo, txLineMat);
    txLine.computeLineDistances();
    scene.add(txLine);

    // Incident Wavefront Ribbons
    const numWavefronts = 5;
    for (let i = 0; i < numWavefronts; i++) {
      const arcCurve = new THREE.EllipseCurve(
        0, 0,
        3 + i * 1.5, 3 + i * 1.5,
        0, Math.PI / 2,
        false, 0
      );
      const points = arcCurve.getPoints(24);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(
        points.map(p => new THREE.Vector3(p.x, 0, p.y))
      );
      const arcMat = new THREE.LineBasicMaterial({
        color: 0xc94f2a,
        transparent: true,
        opacity: 0.65 - i * 0.1
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      arcLine.userData = { baseRadius: 3 + i * 1.5, offset: i * (Math.PI / 3) };
      incidentWaveGroup.add(arcLine);
    }
    incidentWaveGroup.position.set(-6, 6, -5);
    incidentWaveGroup.lookAt(0, 2, 0);
    scene.add(incidentWaveGroup);

    // Reflected Wavefront Ribbons (towards RX)
    for (let i = 0; i < numWavefronts; i++) {
      const arcCurve = new THREE.EllipseCurve(
        0, 0,
        2.5 + i * 1.6, 2.5 + i * 1.6,
        -Math.PI / 4, Math.PI / 4,
        false, 0
      );
      const points = arcCurve.getPoints(24);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(
        points.map(p => new THREE.Vector3(p.x, 0, p.y))
      );
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x3a7ebf,
        transparent: true,
        opacity: 0.7 - i * 0.1
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      arcLine.userData = { baseRadius: 2.5 + i * 1.6, offset: i * (Math.PI / 3) };
      reflectedWaveGroup.add(arcLine);
    }
    updateReflectedWaveAngle();
    scene.add(reflectedWaveGroup);
  }

  function updateReflectedWaveAngle() {
    if (!reflectedWaveGroup) return;
    // Map phase (0 to 360) to reflection steering angle
    const angleRad = ((simState.phase - 180) / 180) * (Math.PI / 3.5); // +/- 50 degrees
    
    reflectedWaveGroup.position.set(0, 2.2, 0);
    reflectedWaveGroup.rotation.y = -(angleRad + 0.4);
  }

  /* --- Canvas Interaction & Cell Picking --- */
  function onCanvasPointerDown(event) {
    if (!el.threeCanvas) return;
    const rect = el.threeCanvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(unitCellMeshes);

    if (intersects.length > 0) {
      const selected = intersects[0].object;
      if (selected.userData && selected.userData.isUnitCell) {
        simState.selectedCell = {
          row: selected.userData.row,
          col: selected.userData.col,
          index: selected.userData.index
        };
        highlightSelectedCell(selected.userData.index);
        updateInspectionPanel();
        update2DArraySelection();
      }
    }
  }

  function highlightSelectedCell(index) {
    if (!unitCellMeshes || unitCellMeshes.length === 0) return;
    unitCellMeshes.forEach((mesh, idx) => {
      if (idx === index) {
        mesh.material.color.setHex(0xffaa44);
        mesh.material.emissive.setHex(0x552200);
        mesh.scale.set(1.08, 1.4, 1.08);
      } else {
        const cellPhaseShift = (simState.phase + (mesh.userData.col * 15)) % 360;
        const tintFactor = Math.sin((cellPhaseShift * Math.PI) / 180) * 0.15;
        mesh.material.color.setHex(tintFactor > 0 ? 0xd48f52 : 0xb57338);
        mesh.material.emissive.setHex(0x000000);
        mesh.scale.set(1, 1, 1);
      }
    });
  }

  /* --- 3D Animation Loop --- */
  let animClock = 0;
  function animate3D() {
    requestAnimationFrame(animate3D);

    if (controls) controls.update();

    if (simState.autoRotate && risGroup) {
      risGroup.rotation.y += 0.004;
    }

    if (simState.waveAnimActive) {
      animClock += 0.03 * (simState.frequency / 10.0);

      // Animate incident wavefront arcs
      if (incidentWaveGroup && simState.showField) {
        incidentWaveGroup.children.forEach((arc) => {
          const t = (animClock + arc.userData.offset) % 3;
          arc.position.z = t * 2.5;
          arc.material.opacity = Math.max(0, 0.8 - (t / 3) * 0.8);
        });
      }

      // Animate reflected wavefront arcs
      if (reflectedWaveGroup && simState.showField) {
        reflectedWaveGroup.children.forEach((arc) => {
          const t = (animClock + arc.userData.offset) % 3;
          arc.position.x = t * 3.2;
          arc.material.opacity = Math.max(0, 0.85 - (t / 3) * 0.85);
        });
      }
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function onWindowResize() {
    if (!camera || !renderer || !el.canvasWrap) return;
    const width = el.canvasWrap.clientWidth;
    const height = el.canvasWrap.clientHeight || 540;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function showFallbackView() {
    if (el.fallbackBox) el.fallbackBox.style.display = 'block';
    if (el.threeCanvas) el.threeCanvas.style.display = 'none';
  }

  /* =========================================================
     2. ROTARY PHASE DIAL CONTROL
     ========================================================= */
  let isDraggingDial = false;

  function initPhaseDial() {
    if (!el.phaseDialContainer) return;

    el.phaseDialContainer.addEventListener('pointerdown', startDialDrag);
    window.addEventListener('pointermove', onDialDrag);
    window.addEventListener('pointerup', stopDialDrag);

    // Quick Phase Preset Chips
    el.phaseChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const deg = parseInt(chip.getAttribute('data-phase'), 10);
        setPhase(deg);
      });
    });

    // Phase Sweep Button
    if (el.btnPhaseSweep) {
      el.btnPhaseSweep.addEventListener('click', togglePhaseSweep);
    }

    updatePhaseDialUI();
  }

  function startDialDrag(e) {
    isDraggingDial = true;
    updateDialFromPointer(e);
  }

  function onDialDrag(e) {
    if (!isDraggingDial) return;
    updateDialFromPointer(e);
  }

  function stopDialDrag() {
    isDraggingDial = false;
  }

  function updateDialFromPointer(e) {
    if (!el.phaseDialContainer) return;
    const rect = el.phaseDialContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Angle in degrees from top (0 deg at top, clockwise)
    let angleRad = Math.atan2(dy, dx) + Math.PI / 2;
    if (angleRad < 0) angleRad += Math.PI * 2;
    let deg = Math.round((angleRad / (Math.PI * 2)) * 360);
    if (deg >= 360) deg = 0;

    setPhase(deg);
  }

  function setPhase(deg) {
    simState.phase = Math.max(0, Math.min(360, deg));
    updatePhaseDialUI();
    updateTelemetry();
    updateReflectedWaveAngle();
    highlightSelectedCell(simState.selectedCell.index);
    updateInspectionPanel();
    update2DArrayVisuals();
    updateChartMarkers();
  }

  function updatePhaseDialUI() {
    if (el.phaseDegReadout) {
      el.phaseDegReadout.textContent = `${simState.phase}°`;
    }

    if (el.phaseDialPointer) {
      el.phaseDialPointer.setAttribute('transform', `rotate(${simState.phase} 85 85)`);
    }

    // Update active preset chip
    el.phaseChips.forEach(chip => {
      const val = parseInt(chip.getAttribute('data-phase'), 10);
      chip.classList.toggle('active', val === simState.phase);
    });
  }

  function togglePhaseSweep() {
    if (!el.btnPhaseSweep) return;
    if (simState.phaseSweepActive) {
      clearInterval(simState.phaseSweepTimer);
      simState.phaseSweepActive = false;
      el.btnPhaseSweep.classList.remove('running');
      el.btnPhaseSweep.innerHTML = '<span>▶</span> Run Phase Sweep';
    } else {
      simState.phaseSweepActive = true;
      el.btnPhaseSweep.classList.add('running');
      el.btnPhaseSweep.innerHTML = '<span>⏹</span> Stop Sweep';

      const states = [0, 60, 120, 180, 240, 300, 360];
      let step = 0;
      simState.phaseSweepTimer = setInterval(() => {
        setPhase(states[step]);
        step++;
        if (step >= states.length) {
          step = 0;
        }
      }, 450);
    }
  }

  /* =========================================================
     3. RF FREQUENCY TUNER CONTROL
     ========================================================= */
  function initFrequencyControl() {
    if (!el.freqSlider) return;

    el.freqSlider.addEventListener('input', (e) => {
      setFrequency(parseFloat(e.target.value));
    });

    el.freqChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const f = parseFloat(chip.getAttribute('data-freq'));
        setFrequency(f);
      });
    });

    if (el.btnFreqSweep) {
      el.btnFreqSweep.addEventListener('click', toggleFrequencySweep);
    }

    updateFrequencyUI();
  }

  function setFrequency(f) {
    simState.frequency = Math.max(8.00, Math.min(12.00, f));
    if (el.freqSlider) el.freqSlider.value = simState.frequency.toFixed(2);
    updateFrequencyUI();
    updateTelemetry();
    updateChartMarkers();
  }

  function updateFrequencyUI() {
    if (el.freqReadout) {
      el.freqReadout.textContent = `${simState.frequency.toFixed(2)} GHz`;
    }

    el.freqChips.forEach(chip => {
      const val = parseFloat(chip.getAttribute('data-freq'));
      chip.classList.toggle('active', Math.abs(val - simState.frequency) < 0.05);
    });
  }

  function toggleFrequencySweep() {
    if (!el.btnFreqSweep) return;
    if (simState.freqSweepActive) {
      clearInterval(simState.freqSweepTimer);
      simState.freqSweepActive = false;
      el.btnFreqSweep.classList.remove('running');
      el.btnFreqSweep.innerHTML = '<span>▶</span> Run Freq Sweep';
    } else {
      simState.freqSweepActive = true;
      el.btnFreqSweep.classList.add('running');
      el.btnFreqSweep.innerHTML = '<span>⏹</span> Stop Sweep';

      let curr = 8.00;
      simState.freqSweepTimer = setInterval(() => {
        curr += 0.1;
        if (curr > 12.05) {
          curr = 8.00;
        }
        setFrequency(curr);
      }, 80);
    }
  }

  /* =========================================================
     4. VIEWPORT TOOLBAR CONTROLS
     ========================================================= */
  function initViewportTools() {
    if (el.btnResetView) {
      el.btnResetView.addEventListener('click', () => {
        if (!camera || !controls) return;
        camera.position.set(22, 18, 28);
        controls.target.set(0, 2, 0);
        controls.update();
      });
    }

    if (el.btnAutoRotate) {
      el.btnAutoRotate.addEventListener('click', () => {
        simState.autoRotate = !simState.autoRotate;
        el.btnAutoRotate.classList.toggle('active', simState.autoRotate);
      });
    }

    if (el.btnViewTop) {
      el.btnViewTop.addEventListener('click', () => {
        if (!camera || !controls) return;
        camera.position.set(0, 36, 0.01);
        controls.target.set(0, 2, 0);
        controls.update();
      });
    }

    if (el.btnViewFront) {
      el.btnViewFront.addEventListener('click', () => {
        if (!camera || !controls) return;
        camera.position.set(0, 2, 34);
        controls.target.set(0, 2, 0);
        controls.update();
      });
    }

    if (el.btnViewSide) {
      el.btnViewSide.addEventListener('click', () => {
        if (!camera || !controls) return;
        camera.position.set(34, 2, 0);
        controls.target.set(0, 2, 0);
        controls.update();
      });
    }

    if (el.btnToggleGrid) {
      el.btnToggleGrid.addEventListener('click', () => {
        simState.showGrid = !simState.showGrid;
        if (gridHelper) gridHelper.visible = simState.showGrid;
        el.btnToggleGrid.classList.toggle('active', simState.showGrid);
      });
    }

    if (el.btnToggleAxes) {
      el.btnToggleAxes.addEventListener('click', () => {
        simState.showAxes = !simState.showAxes;
        if (axesGroup) axesGroup.visible = simState.showAxes;
        el.btnToggleAxes.classList.toggle('active', simState.showAxes);
      });
    }

    if (el.btnToggleField) {
      el.btnToggleField.addEventListener('click', () => {
        simState.showField = !simState.showField;
        if (incidentWaveGroup) incidentWaveGroup.visible = simState.showField;
        if (reflectedWaveGroup) reflectedWaveGroup.visible = simState.showField;
        el.btnToggleField.classList.toggle('active', simState.showField);
      });
    }

    if (el.btnToggleAnim) {
      el.btnToggleAnim.addEventListener('click', () => {
        simState.waveAnimActive = !simState.waveAnimActive;
        el.btnToggleAnim.classList.toggle('active', simState.waveAnimActive);
      });
    }
  }

  /* =========================================================
     5. TELEMETRY & INSPECTION
     ========================================================= */
  function updateTelemetry() {
    if (el.teleFreq) el.teleFreq.textContent = `${simState.frequency.toFixed(2)} GHz`;
    if (el.telePhase) el.telePhase.textContent = `${simState.phase}°`;
  }

  function updateInspectionPanel() {
    if (el.inspectCellId) {
      el.inspectCellId.textContent = `Cell [${simState.selectedCell.row}, ${simState.selectedCell.col}] (#${simState.selectedCell.index + 1})`;
    }
    if (el.inspectCellPhase) {
      const cellPhase = (simState.phase + (simState.selectedCell.col * 15)) % 360;
      el.inspectCellPhase.textContent = `${cellPhase}° (Reflection State)`;
    }
  }

  /* =========================================================
     6. 2D METASURFACE MATRIX
     ========================================================= */
  function init2DArray() {
    if (!el.arrayMatrix2D) return;

    el.arrayMatrix2D.innerHTML = '';
    const rows = 8;
    const cols = 8;

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'array-cell-2d';
        cellEl.setAttribute('data-index', idx);
        cellEl.setAttribute('title', `Cell [${r + 1}, ${c + 1}]`);

        const patchInner = document.createElement('div');
        patchInner.className = 'cell-inner-patch';
        cellEl.appendChild(patchInner);

        const currentIdx = idx;
        const currR = r + 1;
        const currC = c + 1;

        cellEl.addEventListener('click', () => {
          simState.selectedCell = { row: currR, col: currC, index: currentIdx };
          highlightSelectedCell(currentIdx);
          updateInspectionPanel();
          update2DArraySelection();
        });

        el.arrayMatrix2D.appendChild(cellEl);
        idx++;
      }
    }

    update2DArraySelection();
    update2DArrayVisuals();
  }

  function update2DArraySelection() {
    if (!el.arrayMatrix2D) return;
    const cells = el.arrayMatrix2D.querySelectorAll('.array-cell-2d');
    cells.forEach((c, idx) => {
      c.classList.toggle('selected', idx === simState.selectedCell.index);
    });
  }

  function update2DArrayVisuals() {
    if (!el.arrayMatrix2D) return;
    const cells = el.arrayMatrix2D.querySelectorAll('.array-cell-2d');
    cells.forEach((c, idx) => {
      const col = idx % 8;
      const cellPhase = (simState.phase + (col * 15)) % 360;
      const patch = c.querySelector('.cell-inner-patch');
      if (patch) {
        const scale = 0.65 + (Math.sin((cellPhase * Math.PI) / 180) * 0.15);
        patch.style.transform = `scale(${scale})`;
        patch.style.backgroundColor = cellPhase > 180 ? '#c98144' : '#8f562d';
      }
    });
  }

  /* =========================================================
     7. SCIENTIFIC GRAPHS (S11, S21, REFLECTION PHASE)
     ========================================================= */
  function initCharts() {
    if (typeof Chart === 'undefined') return;

    // Global Dark Engineering Theme Defaults for Chart.js
    Chart.defaults.color = '#7a7772';
    Chart.defaults.font.family = 'JetBrains Mono, monospace';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.elements.point.radius = 0;
    Chart.defaults.elements.point.hitRadius = 8;

    // Frequencies array: 8.0 to 12.0 GHz in steps of 0.05
    const freqs = [];
    for (let f = 8.0; f <= 12.0; f += 0.05) {
      freqs.push(parseFloat(f.toFixed(2)));
    }

    // S11 Curve Model (Resonance dip at 10.0 GHz, S11 < -30 dB)
    const s11Data = freqs.map(f => {
      const df = f - 10.0;
      const depth = -34.0;
      const bw = 0.35;
      const val = -2.5 - Math.abs(depth) * Math.exp(-(df * df) / (2 * bw * bw));
      return parseFloat(val.toFixed(2));
    });

    // S21 Curve Model (Around -3 dB reference at 10.0 GHz)
    const s21Data = freqs.map(f => {
      const df = f - 10.0;
      const val = -3.1 - (df * df) * 0.45;
      return parseFloat(val.toFixed(2));
    });

    // Phase Curve Model (Sigmoid phase transition across band)
    const phaseData = freqs.map(f => {
      const df = f - 10.0;
      const val = 180 - (Math.atan(df * 5.0) * (180 / Math.PI));
      return parseFloat(val.toFixed(1));
    });

    // Vertical Cursor Plugin
    const verticalLinePlugin = {
      id: 'verticalLine',
      afterDraw: (chart) => {
        if (chart.tooltip?._active?.length) return;
        const ctx = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        
        const xPos = xAxis.getPixelForValue(simState.frequency);
        if (xPos >= xAxis.left && xPos <= xAxis.right) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(xPos, yAxis.top);
          ctx.lineTo(xPos, yAxis.bottom);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#c94f2a';
          ctx.setLineDash([4, 4]);
          ctx.stroke();

          // Label
          ctx.fillStyle = '#c94f2a';
          ctx.font = '10px JetBrains Mono';
          ctx.fillText(`${simState.frequency.toFixed(2)} GHz`, xPos + 4, yAxis.top + 14);
          ctx.restore();
        }
      }
    };

    // 1. S11 Chart
    if (el.s11Canvas) {
      charts.s11 = new Chart(el.s11Canvas, {
        type: 'line',
        data: {
          labels: freqs,
          datasets: [{
            data: s11Data,
            borderColor: '#c94f2a',
            borderWidth: 2,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: 'Frequency (GHz)', color: '#66635d' },
              grid: { color: 'rgba(255,255,255,0.04)' }
            },
            y: {
              title: { display: true, text: 'S11 (dB)', color: '#66635d' },
              min: -38,
              max: 0,
              grid: { color: 'rgba(255,255,255,0.04)' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `S11: ${ctx.parsed.y} dB (Ref: < -30 dB @ 10 GHz)`
              }
            }
          }
        },
        plugins: [verticalLinePlugin]
      });
    }

    // 2. S21 Chart
    if (el.s21Canvas) {
      charts.s21 = new Chart(el.s21Canvas, {
        type: 'line',
        data: {
          labels: freqs,
          datasets: [{
            data: s21Data,
            borderColor: '#3a7ebf',
            borderWidth: 2,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: 'Frequency (GHz)', color: '#66635d' },
              grid: { color: 'rgba(255,255,255,0.04)' }
            },
            y: {
              title: { display: true, text: 'S21 (dB)', color: '#66635d' },
              min: -10,
              max: 0,
              grid: { color: 'rgba(255,255,255,0.04)' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `S21: ${ctx.parsed.y} dB (Ref: ≈ -3 dB @ 10 GHz)`
              }
            }
          }
        },
        plugins: [verticalLinePlugin]
      });
    }

    // 3. Reflection Phase Chart
    if (el.phaseChartCanvas) {
      charts.phase = new Chart(el.phaseChartCanvas, {
        type: 'line',
        data: {
          labels: freqs,
          datasets: [{
            data: phaseData,
            borderColor: '#4aab6d',
            borderWidth: 2,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: 'Frequency (GHz)', color: '#66635d' },
              grid: { color: 'rgba(255,255,255,0.04)' }
            },
            y: {
              title: { display: true, text: 'Reflection Phase (deg)', color: '#66635d' },
              min: 0,
              max: 360,
              grid: { color: 'rgba(255,255,255,0.04)' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `Reflection Phase: ${ctx.parsed.y}°`
              }
            }
          }
        },
        plugins: [verticalLinePlugin]
      });
    }
  }

  function updateChartMarkers() {
    if (charts.s11) charts.s11.update('none');
    if (charts.s21) charts.s21.update('none');
    if (charts.phase) charts.phase.update('none');
  }

  /* =========================================================
     INITIALIZE WORKSTATION
     ========================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    init3DScene();
    initPhaseDial();
    initFrequencyControl();
    initViewportTools();
    init2DArray();
    initCharts();
    updateTelemetry();
    updateInspectionPanel();
  });

})();
