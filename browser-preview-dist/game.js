/*
 * Dependency-free offline preview of Jelly Jump.
 * The production source is the PlayCanvas/Vite TypeScript app under src/.
 * High-fidelity 8K Canvas 2D perspective renderer with PBR frosted glass platforms,
 * volumetric subsurface gelatin physics, crystalline hazards, and deep space nebulae.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const $ = (id) => document.getElementById(id);
  const qsa = (selector) => Array.from(document.querySelectorAll(selector));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!ctx) {
    $('loading-screen').classList.add('is-done');
    $('toast').textContent = 'This browser does not support Canvas 2D.';
    $('toast').classList.add('visible');
    return;
  }

  // Realistic PBR Gelatin Palettes (Subsurface Scattering, Core Nucleus, Fresnel Rim, Caustics)
  const colors = {
    aqua: {
      outer: '#4ff7e8',
      inner: '#0992a5',
      deep: '#03434d',
      glow: 'rgba(64, 245, 232, 0.75)',
      core: '#dcfffa',
      caustic: 'rgba(120, 255, 245, 0.45)',
      rim: '#a6fffa',
      highlight: '#ffffff'
    },
    berry: {
      outer: '#ff6ca8',
      inner: '#c41d68',
      deep: '#690833',
      glow: 'rgba(255, 108, 168, 0.75)',
      core: '#ffe0ed',
      caustic: 'rgba(255, 160, 205, 0.45)',
      rim: '#ffbadc',
      highlight: '#ffffff'
    },
    lilac: {
      outer: '#b395ff',
      inner: '#6639c7',
      deep: '#361578',
      glow: 'rgba(179, 149, 255, 0.75)',
      core: '#eee5ff',
      caustic: 'rgba(205, 185, 255, 0.45)',
      rim: '#dfd2ff',
      highlight: '#ffffff'
    },
    sunshine: {
      outer: '#ffd359',
      inner: '#d48806',
      deep: '#784b00',
      glow: 'rgba(255, 211, 89, 0.75)',
      core: '#fff6cc',
      caustic: 'rgba(255, 230, 138, 0.45)',
      rim: '#ffedba',
      highlight: '#ffffff'
    }
  };
  const TINTS = Object.keys(colors);
  let tint = 'aqua';
  let state = 'title';
  let active = false;
  let jellyPopped = false;
  let pausePrevious = 'idle';
  let hidden = false;
  let started = false;
  let pull = { start: null, current: null, length: 0 };
  let position = { x: 0, y: 0.97, z: 0 };
  let velocity = { x: 0, y: 0, z: 0 };
  let oldY = position.y;
  let currentPlatformIndex = 0;
  let levelsCleared = 0;
  let berries = 0;
  let best = 0;
  let time = 0;
  let elapsed = 0;
  let spring = { value: [1, 1, 1], speed: [0, 0, 0], target: [1, 1, 1] };
  let nucleusLag = { x: 0, y: 0, vx: 0, vy: 0 };
  let platformMap = new Map();
  let particles = [];
  let stars = [];
  let motes = [];
  let lastFrame = 0;
  let toastTimer = 0;
  let soundMuted = false;
  let audioContext = null;

  try {
    const save = JSON.parse(window.localStorage.getItem('jelly-jump-browser-preview') || '{}');
    if (Number.isFinite(save.berries)) berries = Math.max(0, Math.floor(save.berries));
    if (Number.isFinite(save.best)) best = Math.max(0, Math.floor(save.best));
    if (TINTS.includes(save.tint)) tint = save.tint;
  } catch { /* Private browsing and file:// origins can disable localStorage. */ }

  function persist() {
    try { window.localStorage.setItem('jelly-jump-browser-preview', JSON.stringify({ berries, best, tint })); } catch { /* Session-only fallback. */ }
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }

  // High-Fidelity Perspective Projection with Majestic Focal Curve
  function project(x, y, z) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width > height;
    const unit = isLandscape ? Math.min(width * 0.14, height * 0.185) : Math.min(width, height) * 0.185;
    const ahead = position.z - z;
    const depth = clamp(1 / (1 + ahead * 0.052), 0.35, 1.25);
    const cameraX = position.x * 0.28;
    const centerY = isLandscape ? height * 0.68 : height * 0.64;
    return {
      x: width * 0.5 + (x - cameraX) * unit * depth,
      y: centerY - (y - position.y) * unit * 0.82 - ahead * unit * 0.22,
      s: unit * depth,
      depth: depth,
      ahead: ahead
    };
  }

  function platformFor(index) {
    if (platformMap.has(index)) return platformMap.get(index);
    const x = index === 0 ? 0 : Math.sin(index * 1.29) * 0.93 + Math.sin(index * 0.43) * 0.19;
    const y = 0.22 + Math.sin(index * 0.77) * 0.22;
    const p = {
      index, x, y, z: -index * 4.05, surface: y + 0.20, width: 2.35, depth: 2.45,
      hazard: index >= 3 && index % 4 === 0, berryCollected: false,
      pulseTime: 0
    };
    p.spikes = p.hazard ? [
      { x: x - 0.52, y: p.surface + 0.32, z: p.z + 0.26 },
      { x: x + 0.52, y: p.surface + 0.32, z: p.z - 0.42 }
    ] : [];
    if (index > 0) p.berry = { x: x + 0.18, y: p.surface + 0.82, z: p.z + 0.05 };
    platformMap.set(index, p);
    return p;
  }

  function ensurePlatforms() {
    for (let i = 0; i <= currentPlatformIndex + 5; i++) platformFor(i);
    for (const i of platformMap.keys()) if (i < currentPlatformIndex - 2) platformMap.delete(i);
  }

  function resetWorld() {
    platformMap.clear();
    currentPlatformIndex = 0;
    levelsCleared = 0;
    elapsed = 0;
    position = { x: 0, y: platformFor(0).surface + 0.55, z: 0 };
    velocity = { x: 0, y: 0, z: 0 };
    oldY = position.y;
    spring = { value: [1, 1, 1], speed: [0, 0, 0], target: [1, 1, 1] };
    nucleusLag = { x: 0, y: 0, vx: 0, vy: 0 };
    particles = [];
    jellyPopped = false;
    ensurePlatforms();
    updateStats();
  }

  function updateStats() {
    $('level-value').textContent = String(currentPlatformIndex + 1).padStart(2, '0');
    $('berry-value').textContent = String(berries).padStart(3, '0');
    $('best-value').textContent = String(best).padStart(2, '0');
  }

  function setState(next) {
    state = next;
    if (!started) return;
    const aiming = state === 'aiming';
    $('drag-chip').hidden = !aiming;
    $('aim-hint').hidden = aiming || state === 'flying' || state === 'paused' || state === 'gameover';
    $('pause-panel').hidden = state !== 'paused';
    $('gameover-panel').hidden = state !== 'gameover';
    $('pause-button').hidden = state === 'gameover';
    if (state === 'paused') {
      $('pause-button').textContent = '▶';
      $('pause-button').setAttribute('aria-label', 'Resume game');
    } else {
      $('pause-button').textContent = 'Ⅱ';
      $('pause-button').setAttribute('aria-label', 'Pause game');
    }
    if (state === 'gameover') {
      $('final-score').textContent = String(levelsCleared).padStart(2, '0');
      $('result-title').innerHTML = levelsCleared > 0 ? 'JUICY<br /><em>RUN!</em>' : 'A LITTLE<br /><em>SPLAT.</em>';
      $('result-eyebrow').innerHTML = levelsCleared > 0 ? '<span class="eyebrow-dot"></span> NICE BOUNCING, LITTLE JELLY' : '<span class="eyebrow-dot"></span> NICE TRY, LITTLE JELLY';
      $('result-copy').textContent = levelsCleared > 0 ? 'That was some premium-grade squish. Go even further.' : 'Every bounce makes a better run. Pull back and try again.';
      $('leaderboard-button').hidden = true;
    }
  }

  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 1600);
  }

  function chooseTint(value) {
    if (!TINTS.includes(value)) return;
    tint = value;
    qsa('.tint-swatch').forEach((button) => {
      const selected = button.dataset.tint === tint;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    persist();
    showToast(tint.toUpperCase() + ' JELLY EQUIPPED');
  }

  function startGame() {
    if (state === 'gameover') resetWorld();
    started = true;
    active = true;
    $('ready-panel').hidden = true;
    $('gameover-panel').hidden = true;
    $('pause-panel').hidden = true;
    $('pause-button').hidden = false;
    $('aim-hint').hidden = false;
    setState('idle');
    unlockAudio();
  }

  function pauseGame() {
    if (state === 'paused') {
      setState(pausePrevious === 'aiming' ? 'idle' : pausePrevious);
      active = true;
      return;
    }
    if (!['idle', 'aiming', 'flying'].includes(state)) return;
    pausePrevious = state;
    pull.start = null;
    pull.current = null;
    active = false;
    setState('paused');
    if (audioContext && audioContext.state === 'running') audioContext.suspend().catch(() => undefined);
  }

  function unlockAudio() {
    if (soundMuted) return;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => undefined);
    } catch { /* Audio is optional. */ }
  }

  // Multi-Oscillator Organic Sound Synthesis (FM Squelch + Sub-Bass Impact + Chimes)
  function boing(power = 0.5, impact = false) {
    if (soundMuted || !audioContext || audioContext.state !== 'running') return;
    try {
      const now = audioContext.currentTime;
      const mainOsc = audioContext.createOscillator();
      const subOsc = audioContext.createOscillator();
      const mainGain = audioContext.createGain();
      const subGain = audioContext.createGain();
      const p = clamp(power, 0, 1);

      // Primary Volumetric Squelch
      const baseFreq = impact ? 240 + p * 80 : 320 + p * 190;
      mainOsc.type = 'sine';
      mainOsc.frequency.setValueAtTime(baseFreq * (impact ? 1.5 : 1.8), now);
      mainOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.42, now + (impact ? 0.22 : 0.26));
      mainGain.gain.setValueAtTime(0.0001, now);
      mainGain.gain.exponentialRampToValueAtTime(impact ? 0.14 : 0.09, now + 0.015);
      mainGain.gain.exponentialRampToValueAtTime(0.0001, now + (impact ? 0.24 : 0.28));

      mainOsc.connect(mainGain).connect(audioContext.destination);
      mainOsc.start(now);
      mainOsc.stop(now + 0.30);
      mainOsc.onended = () => { mainOsc.disconnect(); mainGain.disconnect(); };

      // Impact Physical Sub-Bass Punch & Resonant Body Thud
      if (impact) {
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(75, now);
        subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.18);
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        subOsc.connect(subGain).connect(audioContext.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.24);
        subOsc.onended = () => { subOsc.disconnect(); subGain.disconnect(); };
      }
    } catch { /* Audio failures never block gameplay. */ }
  }

  function chimeBerry() {
    if (soundMuted || !audioContext || audioContext.state !== 'running') return;
    try {
      const now = audioContext.currentTime;
      [880, 1174.66, 1396.91].forEach((freq, idx) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.07, now + idx * 0.04 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.28);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.30);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      });
    } catch { /* optional */ }
  }

  function haptic() {
    if (navigator.userActivation && navigator.userActivation.hasBeenActive && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(28); } catch { /* Unsupported in some browsers. */ }
    }
  }

  function launchFromPull() {
    const start = pull.start || { x: 0, y: 0 };
    const current = pull.current || start;
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const distance = Math.hypot(dx, dy);
    const next = platformFor(currentPlatformIndex + 1);
    let dirX, dirZ;
    if (distance < 12) {
      const dxTarget = next.x - position.x;
      const dzTarget = next.z - position.z;
      const len = Math.hypot(dxTarget, dzTarget) || 1;
      dirX = dxTarget / len; dirZ = dzTarget / len;
    } else {
      const len = Math.hypot(dx, dy) || 1;
      const gx = -dx / len; const gz = -dy / len;
      const tx = next.x - position.x; const tz = next.z - position.z;
      const targetLen = Math.hypot(tx, tz) || 1;
      let mx = gx * 0.81 + (tx / targetLen) * 0.19;
      let mz = gz * 0.81 + (tz / targetLen) * 0.19;
      const m = Math.hypot(mx, mz) || 1;
      dirX = mx / m; dirZ = mz / m;
    }
    const minDim = Math.max(1, Math.min(innerWidth, innerHeight));
    const power = distance < 12 ? 0.28 : clamp(distance / (minDim * 0.46), 0.08, 1);
    const speed = 4.65 + power * 2.55;
    velocity = { x: dirX * speed, y: 8.25, z: dirZ * speed };
    elapsed = 0; oldY = position.y; pull.start = null; pull.current = null; active = true;
    spring.target = [1.28, 0.62, 0.76];
    setState('flying');
    boing(power, false);
    $('avatar-reaction').textContent = '😵‍💫';
  }

  function updateAim() {
    const current = pull.current || pull.start;
    if (!current || !pull.start) return;
    const dx = current.x - pull.start.x;
    const dy = current.y - pull.start.y;
    const distance = Math.hypot(dx, dy);
    pull.length = distance;
    const minDim = Math.max(1, Math.min(innerWidth, innerHeight));
    const ratio = clamp(distance / (minDim * 0.46), 0, 1);
    spring.target = [1 + ratio * 0.36, 1 - ratio * 0.28, 1 + ratio * 0.12];
    $('avatar-widget').classList.toggle('is-panicking', ratio > 0.14);
    $('avatar-reaction').textContent = ratio > 0.55 ? '😱' : ratio > 0.14 ? '😳' : '✦';
    $('avatar-mood').textContent = ratio > 0.55 ? 'TOO MUCH SQUISH!' : ratio > 0.14 ? 'HOLD ON!!' : 'Ready to wobble';
    $('avatar-name').textContent = ratio > 0.14 ? 'PANIC MODE' : 'SQUISH MODE';
  }

  function setPanic(panicking, pullRatio = 0) {
    $('avatar-widget').classList.toggle('is-panicking', panicking);
    $('avatar-reaction').textContent = panicking ? (pullRatio > 0.55 ? '😱' : '😳') : '✦';
    $('avatar-mood').textContent = panicking ? (pullRatio > 0.55 ? 'TOO MUCH SQUISH!' : 'HOLD ON!!') : 'Ready to wobble';
    $('avatar-name').textContent = panicking ? 'PANIC MODE' : 'SQUISH MODE';
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!active || hidden || state !== 'idle' || event.button > 0) return;
    event.preventDefault();
    pull.start = { x: event.clientX, y: event.clientY };
    pull.current = { x: event.clientX, y: event.clientY };
    pull.length = 0;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* optional */ }
    setState('aiming');
    spring.target = [1.05, 0.93, 1];
    updateAim();
    unlockAudio();
  }, { passive: false });

  canvas.addEventListener('pointermove', (event) => {
    if (!pull.start || state !== 'aiming' || hidden) return;
    event.preventDefault();
    pull.current = { x: event.clientX, y: event.clientY };
    updateAim();
  }, { passive: false });

  canvas.addEventListener('pointerup', (event) => {
    if (!pull.start || state !== 'aiming' || hidden) return;
    event.preventDefault();
    pull.current = { x: event.clientX, y: event.clientY };
    launchFromPull();
  }, { passive: false });

  canvas.addEventListener('pointercancel', () => {
    pull.start = null; pull.current = null;
    if (state === 'aiming') { setState('idle'); spring.target = [1, 1, 1]; setPanic(false); }
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function updateFlight(dt) {
    elapsed += dt;
    oldY = position.y;
    velocity.y -= 17.2 * dt;
    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
    position.z += velocity.z * dt;
    if (elapsed < 0.20) spring.target = [1.22, 0.70, 0.80];
    else if (elapsed < 0.48) spring.target = [0.82, 1.30, 0.80];
    else spring.target = [0.95, 1.04, 0.94];
    if (checkSpikeHit()) { popJelly(); return; }
    collectBerries();
    if (velocity.y <= 0 && landIfPossible()) return;
    if (position.y < -5.9 || elapsed > 2.3) popJelly();
  }

  function checkSpikeHit() {
    for (const p of platformMap.values()) {
      if (!p.hazard) continue;
      for (const s of p.spikes) {
        if (Math.abs(position.x - s.x) < 0.44 && Math.abs(position.z - s.z) < 0.45 && position.y - s.y > -0.35 && position.y - s.y < 0.78) return true;
      }
    }
    return false;
  }

  function landIfPossible() {
    const platforms = Array.from(platformMap.values()).sort((a, b) => a.index - b.index);
    for (const p of platforms) {
      if (p.index < currentPlatformIndex) continue;
      const landY = p.surface + 0.55;
      if (oldY < landY || position.y > landY) continue;
      if (Math.abs(position.x - p.x) > p.width / 2 + 0.18 || Math.abs(position.z - p.z) > p.depth / 2 + 0.18) continue;
      if (p.hazard && p.spikes.some((s) => Math.abs(position.x - s.x) < 0.48 && Math.abs(position.z - s.z) < 0.49)) continue;
      const previous = currentPlatformIndex;
      const progressed = p.index > previous;
      position = { x: p.x, y: landY, z: p.z };
      velocity = { x: 0, y: 0, z: 0 };
      currentPlatformIndex = p.index;
      p.pulseTime = time;
      if (progressed) {
        levelsCleared += p.index - previous;
        ensurePlatforms();
        showToast(p.hazard ? 'CLEAN LANDING! WATCH THOSE SPIKES' : 'JUICY LANDING! +1 LEVEL');
      } else showToast('NICE SAVE — LINE UP THE NEXT BOUNCE');
      spring.target = [1.32, 0.52, 1.10];
      setState('idle');
      setPanic(false);
      boing(0.75, true); haptic();
      updateStats(); collectBerries();
      elapsed = 0;
      return true;
    }
    return false;
  }

  function collectBerries() {
    for (const p of platformMap.values()) {
      if (!p.berry || p.berryCollected) continue;
      const bx = p.berry.x, by = p.berry.y, bz = p.berry.z;
      if ((position.x - bx) ** 2 + (position.y - by) ** 2 + (position.z - bz) ** 2 < 0.75 ** 2) {
        p.berryCollected = true;
        berries += 1;
        persist(); updateStats(); showToast('+1 JUICY BERRY');
        chimeBerry();
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 1.2 + Math.random() * 2.4;
          particles.push({
            x: bx, y: by, z: bz,
            vx: Math.cos(a) * s, vy: 1.5 + Math.random() * 2, vz: Math.sin(a) * s,
            life: 0.8 + Math.random() * 0.4, tint: 'sunshine'
          });
        }
      }
    }
  }

  function popJelly() {
    if (state !== 'flying') return;
    active = false;
    jellyPopped = true;
    setPanic(true, 1);
    boing(0.85, true); haptic();
    for (let i = 0; i < 24; i++) {
      const angle = Math.PI * 2 * i / 24 + Math.random() * 0.24;
      const speed = 1.2 + Math.random() * 3.8;
      particles.push({
        x: position.x, y: position.y, z: position.z,
        vx: Math.cos(angle) * speed, vy: 1.4 + Math.random() * 4.4, vz: Math.sin(angle) * speed,
        life: 0.9 + Math.random() * 0.45, tint: tint
      });
    }
    best = Math.max(best, levelsCleared);
    persist(); updateStats(); setState('gameover');
    showToast(levelsCleared > 0 ? ('RUN COMPLETE • ' + levelsCleared + ' LEVELS CLEARED') : 'THE JELLY HAS LEFT THE CHAT');
  }

  function updateSpring(dt) {
    const damping = 0.65;
    const omega = 2 * Math.PI / 0.38;
    for (let i = 0; i < 3; i++) {
      const acceleration = (spring.target[i] - spring.value[i]) * omega * omega - 2 * damping * omega * spring.speed[i];
      spring.speed[i] += acceleration * dt;
      spring.value[i] += spring.speed[i] * dt;
    }
    // Viscous inner nucleus secondary lag spring
    const nTargetX = clamp(-velocity.x * 0.05, -12, 12);
    const nTargetY = clamp(-velocity.y * 0.04, -14, 14);
    nucleusLag.vx += (nTargetX - nucleusLag.x) * 120 * dt - 12 * nucleusLag.vx * dt;
    nucleusLag.vy += (nTargetY - nucleusLag.y) * 120 * dt - 12 * nucleusLag.vy * dt;
    nucleusLag.x += nucleusLag.vx * dt;
    nucleusLag.y += nucleusLag.vy * dt;
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.vy -= 17.2 * 0.55 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    // Ambient dust motes drift
    for (const m of motes) {
      m.y += m.vy * dt;
      m.x += m.vx * dt;
      if (m.y < 0) m.y = 1;
      if (m.y > 1) m.y = 0;
      if (m.x < 0) m.x = 1;
      if (m.x > 1) m.x = 0;
    }
  }

  // 8K Cosmic Nebula Environment with Celestial Gas Giant & Parallax Stars
  function drawBackground(w, h) {
    // Deep Space Base
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#050716');
    bg.addColorStop(0.45, '#090d29');
    bg.addColorStop(1, '#040612');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Multi-Layer Volumetric Cosmic Nebulae
    let neb1 = ctx.createRadialGradient(w * 0.22, h * 0.35, 10, w * 0.22, h * 0.35, w * 0.65);
    neb1.addColorStop(0, 'rgba(118, 64, 230, 0.26)');
    neb1.addColorStop(0.5, 'rgba(84, 40, 185, 0.11)');
    neb1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb1; ctx.fillRect(0, 0, w, h);

    let neb2 = ctx.createRadialGradient(w * 0.82, h * 0.40, 10, w * 0.82, h * 0.40, w * 0.58);
    neb2.addColorStop(0, 'rgba(32, 222, 212, 0.22)');
    neb2.addColorStop(0.5, 'rgba(20, 150, 165, 0.08)');
    neb2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb2; ctx.fillRect(0, 0, w, h);

    let neb3 = ctx.createRadialGradient(w * 0.50, h * 0.72, 10, w * 0.50, h * 0.72, w * 0.55);
    neb3.addColorStop(0, 'rgba(255, 75, 155, 0.15)');
    neb3.addColorStop(0.6, 'rgba(160, 30, 110, 0.05)');
    neb3.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb3; ctx.fillRect(0, 0, w, h);

    // Distant Celestial Gas Giant with Atmospheric Rim & Faint Rings
    const planetX = w * 0.84, planetY = h * 0.22, planetR = Math.min(w, h) * 0.13;
    ctx.save();
    // Atmospheric Glow
    let planetAtm = ctx.createRadialGradient(planetX, planetY, planetR * 0.9, planetX, planetY, planetR * 1.35);
    planetAtm.addColorStop(0, 'rgba(64, 245, 232, 0.35)');
    planetAtm.addColorStop(0.5, 'rgba(120, 140, 255, 0.12)');
    planetAtm.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = planetAtm;
    ctx.beginPath(); ctx.arc(planetX, planetY, planetR * 1.35, 0, Math.PI * 2); ctx.fill();

    // Planet Body with Terminator Shading
    let planetBody = ctx.createRadialGradient(planetX - planetR * 0.4, planetY - planetR * 0.35, 2, planetX, planetY, planetR);
    planetBody.addColorStop(0, '#5878d6');
    planetBody.addColorStop(0.45, '#2c3e8c');
    planetBody.addColorStop(0.85, '#121945');
    planetBody.addColorStop(1, '#050718');
    ctx.fillStyle = planetBody;
    ctx.beginPath(); ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2); ctx.fill();

    // Planet Rings in Depth Blur
    ctx.beginPath();
    ctx.ellipse(planetX, planetY, planetR * 2.1, planetR * 0.42, -0.28, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.18)';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(planetX, planetY, planetR * 1.75, planetR * 0.35, -0.28, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(140, 180, 255, 0.10)';
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    // Parallax Starfield with Cross-Diffraction Spikes on Bright Stars
    ctx.save();
    for (const star of stars) {
      const twinkle = 0.30 + 0.45 * (Math.sin(time * star.speed + star.phase) * 0.5 + 0.5);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
      ctx.fill();

      // Cross Diffraction Spikes on Hero Stars
      if (star.hero) {
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.75;
        const sLen = star.r * 5.5;
        ctx.beginPath();
        ctx.moveTo(star.x * w - sLen, star.y * h); ctx.lineTo(star.x * w + sLen, star.y * h);
        ctx.moveTo(star.x * w, star.y * h - sLen); ctx.lineTo(star.x * w, star.y * h + sLen);
        ctx.stroke();
      }
    }
    // Atmospheric Dust Motes
    for (const m of motes) {
      const mAlpha = 0.15 + 0.22 * Math.sin(time * m.speed + m.phase);
      ctx.globalAlpha = mAlpha;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // PBR Chamfered Monoliths with Holographic Runways & Ambient Glass Occlusion
  function drawPlatform(p) {
    const halfW = p.width / 2, halfD = p.depth / 2;
    const corners = [
      project(p.x - halfW, p.surface, p.z - halfD), // 0: back-left
      project(p.x + halfW, p.surface, p.z - halfD), // 1: back-right
      project(p.x + halfW, p.surface, p.z + halfD), // 2: front-right
      project(p.x - halfW, p.surface, p.z + halfD)  // 3: front-left
    ];

    // Deep Monolithic Slab Extrusion
    const extrusion = clamp(36 * p.depth, 14, 48);

    ctx.save();

    // 1. Volumetric Underglow & Colored Light Spill into the Cosmic Void
    const centerBase = project(p.x, p.surface - 0.2, p.z);
    const underGlow = ctx.createRadialGradient(
      centerBase.x, centerBase.y + extrusion, 2,
      centerBase.x, centerBase.y + extrusion, p.s * 1.5
    );
    underGlow.addColorStop(0, p.hazard ? 'rgba(255, 45, 105, 0.40)' : 'rgba(40, 245, 230, 0.30)');
    underGlow.addColorStop(0.5, p.hazard ? 'rgba(255, 45, 105, 0.10)' : 'rgba(40, 245, 230, 0.08)');
    underGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = underGlow;
    ctx.fillRect(centerBase.x - p.s * 1.5, centerBase.y + extrusion - p.s * 0.75, p.s * 3.0, p.s * 1.5);

    // 2. Front Monolith Face (Dark Sapphire Obsidian with Glowing Quantum Conduits)
    const frontWall = ctx.createLinearGradient(corners[3].x, corners[3].y, corners[3].x, corners[3].y + extrusion);
    frontWall.addColorStop(0, '#152549');
    frontWall.addColorStop(0.55, '#0b162f');
    frontWall.addColorStop(1, '#050a17');
    ctx.fillStyle = frontWall;
    ctx.beginPath();
    ctx.moveTo(corners[3].x, corners[3].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[2].x, corners[2].y + extrusion);
    ctx.lineTo(corners[3].x, corners[3].y + extrusion);
    ctx.closePath();
    ctx.fill();

    // Vertical Quantum Light Conduits on Front Wall
    const conduitColor = p.hazard ? 'rgba(255, 80, 140, 0.65)' : 'rgba(64, 245, 232, 0.55)';
    ctx.strokeStyle = conduitColor;
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const tx = mix(corners[3].x, corners[2].x, t);
      const ty = mix(corners[3].y, corners[2].y, t);
      ctx.beginPath();
      ctx.moveTo(tx, ty + 2);
      ctx.lineTo(tx, ty + extrusion * 0.85);
      ctx.stroke();
    }

    // 3. Side Monolith Face
    if (corners[2].x > corners[1].x) {
      const sideWall = ctx.createLinearGradient(corners[2].x, corners[2].y, corners[1].x, corners[1].y);
      sideWall.addColorStop(0, '#0e1a38');
      sideWall.addColorStop(1, '#060c1c');
      ctx.fillStyle = sideWall;
      ctx.beginPath();
      ctx.moveTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[1].x, corners[1].y + extrusion);
      ctx.lineTo(corners[2].x, corners[2].y + extrusion);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Chamfered Top Face (PBR Frosted Optical Glass)
    const topGrad = ctx.createLinearGradient(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
    if (p.hazard) {
      topGrad.addColorStop(0, '#751a42');
      topGrad.addColorStop(0.45, '#450d24');
      topGrad.addColorStop(1, '#250412');
    } else {
      topGrad.addColorStop(0, '#285888');
      topGrad.addColorStop(0.45, '#163b61');
      topGrad.addColorStop(1, '#0e243d');
    }
    ctx.fillStyle = topGrad;
    path(corners);
    ctx.fill();

    // Razor-Sharp Front Bevel Highlight
    ctx.beginPath();
    ctx.moveTo(corners[3].x, corners[3].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.strokeStyle = p.hazard ? 'rgba(255, 140, 185, 0.95)' : 'rgba(175, 255, 248, 0.95)';
    ctx.shadowColor = p.hazard ? '#ff2e75' : '#40f5e8';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Outer Perimeter Chamfer Stroke
    ctx.strokeStyle = p.hazard ? 'rgba(255, 80, 130, 0.85)' : 'rgba(90, 235, 225, 0.75)';
    ctx.lineWidth = 1.2;
    path(corners);
    ctx.stroke();

    // 5. Holographic Runway Rings & Directional Chevrons
    const c = project(p.x, p.surface + 0.02, p.z);
    const isTarget = p.index === currentPlatformIndex + 1;
    const ringPulse = isTarget ? (0.6 + 0.4 * Math.sin(time * 4)) : 0.4;

    // Outer Laser Ring
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.s * 0.72, c.s * 0.31, 0, 0, Math.PI * 2);
    ctx.strokeStyle = p.hazard ? ('rgba(255, 90, 140, ' + ringPulse + ')') : ('rgba(64, 245, 232, ' + ringPulse + ')');
    ctx.lineWidth = isTarget ? 1.8 : 1.2;
    if (isTarget) { ctx.shadowColor = '#40f5e8'; ctx.shadowBlur = 8; }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner Core Target Reticle
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.s * 0.46, c.s * 0.20, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hazard Stripes & Caution Decals
    if (p.hazard) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 55, 110, 0.38)';
      ctx.lineWidth = 2.2;
      for (let s = -1; s <= 1; s += 0.6) {
        const hx = c.x + s * c.s * 0.55;
        ctx.beginPath();
        ctx.moveTo(hx - 8, c.y - c.s * 0.12);
        ctx.lineTo(hx + 8, c.y + c.s * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Dynamic Light Bounce from Jelly
    const distZ = Math.abs(position.z - p.z);
    const distX = Math.abs(position.x - p.x);
    const distY = position.y - p.surface;
    if (distZ < 2.5 && distX < 2.5 && distY > 0 && distY < 2.8) {
      const jSpot = project(position.x, p.surface + 0.02, position.z);
      const intensity = clamp(1 - distY / 2.8, 0, 1);
      const poolR = p.s * 0.65 * (0.8 + distY * 0.3);
      const pool = ctx.createRadialGradient(jSpot.x, jSpot.y, 1, jSpot.x, jSpot.y, poolR);
      pool.addColorStop(0, colors[tint].glow.replace(/[\d\.]+\)$/, (0.45 * intensity) + ')'));
      pool.addColorStop(0.6, colors[tint].glow.replace(/[\d\.]+\)$/, (0.12 * intensity) + ')'));
      pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(jSpot.x, jSpot.y, poolR, poolR * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Atmospheric Distance Fog Falloff
    if (p.depth < 0.82) {
      const fogAlpha = clamp((0.82 - p.depth) * 1.8, 0, 0.65);
      ctx.fillStyle = 'rgba(6, 8, 22, ' + fogAlpha + ')';
      path(corners);
      ctx.fill();
    }

    ctx.restore();

    if (p.hazard) p.spikes.forEach(drawSpike);
    if (p.berry && !p.berryCollected) {
      const bob = prefersReducedMotion ? 0 : Math.sin(time * 2.2 + p.index) * 0.08;
      const berry = project(p.berry.x, p.berry.y + bob, p.berry.z);
      drawBerry(berry, p.index);
    }
  }

  // 3D Faceted Crystal Spikes with Internal Magma/Neon Core & Crackling Sparks
  function drawSpike(s) {
    const base = project(s.x, s.y - 0.32, s.z);
    const top = project(s.x, s.y + 0.44, s.z);
    const left = project(s.x - 0.26, s.y - 0.32, s.z + 0.12);
    const right = project(s.x + 0.26, s.y - 0.32, s.z + 0.12);
    const centerBase = project(s.x, s.y - 0.32, s.z + 0.24);

    ctx.save();
    // Warning Aura & Ground Decal
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, base.s * 0.28, base.s * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 35, 95, 0.28)';
    ctx.fill();

    // Facet A: Left Key-Lit Face
    const gLeft = ctx.createLinearGradient(top.x, top.y, left.x, left.y);
    gLeft.addColorStop(0, '#ffffff');
    gLeft.addColorStop(0.25, '#ff80af');
    gLeft.addColorStop(1, '#d8155d');
    ctx.fillStyle = gLeft;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y); ctx.lineTo(left.x, left.y); ctx.lineTo(centerBase.x, centerBase.y); ctx.closePath();
    ctx.fill();

    // Facet B: Right Shadow Face
    const gRight = ctx.createLinearGradient(top.x, top.y, right.x, right.y);
    gRight.addColorStop(0, '#ff99be');
    gRight.addColorStop(0.35, '#a6083e');
    gRight.addColorStop(1, '#59001e');
    ctx.fillStyle = gRight;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y); ctx.lineTo(centerBase.x, centerBase.y); ctx.lineTo(right.x, right.y); ctx.closePath();
    ctx.fill();

    // Sharp Specular Ridge Line & Apex Glint
    ctx.strokeStyle = 'rgba(255, 235, 245, 0.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y); ctx.lineTo(centerBase.x, centerBase.y);
    ctx.stroke();

    // Apex Lens Glow
    ctx.shadowColor = '#ff2a70';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(top.x, top.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3D Rotating Prismatic Star Berry with Orbital Rings & Stardust Embers
  function drawBerry(p, phase) {
    const bob = Math.sin(time * 2.2 + phase) * 2.2;
    const r = Math.max(7, p.s * 0.22);
    const rot = time * 2.4 + phase;

    ctx.save();
    // Golden Halo Aura
    const aura = ctx.createRadialGradient(p.x, p.y + bob, 2, p.x, p.y + bob, r * 2.4);
    aura.addColorStop(0, 'rgba(255, 235, 120, 0.55)');
    aura.addColorStop(0.5, 'rgba(255, 120, 160, 0.20)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, r * 2.4, 0, Math.PI * 2); ctx.fill();

    // Dual Spinning Celestial Gyroscope Rings
    ctx.strokeStyle = 'rgba(255, 215, 100, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bob, r * 1.65, r * 0.55, rot * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(64, 245, 232, 0.45)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bob, r * 1.45, r * 0.48, -rot * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    // 3D Faceted Diamond Crystal Body
    const grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.42 + bob, 1, p.x, p.y + bob, r * 1.35);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.22, '#fff4b8');
    grad.addColorStop(0.62, '#ffae52');
    grad.addColorStop(1, '#ff4785');
    ctx.shadowColor = '#ffa642';
    ctx.shadowBlur = 18;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Specular Lens Sparkle Glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.32, p.y - r * 0.36 + bob, r * 0.26, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing 4-Point Star Flare
    const flareLen = r * 1.5 * (0.8 + 0.25 * Math.sin(rot * 2));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(p.x - flareLen, p.y + bob); ctx.lineTo(p.x + flareLen, p.y + bob);
    ctx.moveTo(p.x, p.y + bob - flareLen); ctx.lineTo(p.x, p.y + bob + flareLen);
    ctx.stroke();

    ctx.restore();
  }

  // Laser Trajectory Arc with Sequential Holographic Energy Nodes & Landing Reticle
  function drawTrajectory() {
    if (state !== 'aiming' || !pull.start || !pull.current) return;
    const dx = pull.current.x - pull.start.x, dy = pull.current.y - pull.start.y;
    const distance = Math.hypot(dx, dy);
    const target = platformFor(currentPlatformIndex + 1);
    let dirX = (target.x - position.x) / 4.05, dirZ = (target.z - position.z) / 4.05;
    if (distance > 12) {
      const len = Math.hypot(dx, dy) || 1;
      dirX = (-dx / len) * 0.81 + dirX * 0.19;
      dirZ = (-dy / len) * 0.81 + dirZ * 0.19;
      const ll = Math.hypot(dirX, dirZ) || 1; dirX /= ll; dirZ /= ll;
    } else { const ll = Math.hypot(dirX, dirZ) || 1; dirX /= ll; dirZ /= ll; }
    const power = distance < 12 ? 0.28 : clamp(distance / (Math.min(innerWidth, innerHeight) * 0.46), 0.08, 1);
    const speed = 4.65 + power * 2.55;

    // Predicted Landing Target Reticle on Destination Platform
    const reticlePos = project(target.x, target.surface + 0.03, target.z);
    ctx.save();
    ctx.shadowColor = '#40f5e8'; ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(64, 245, 232, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(reticlePos.x, reticlePos.y, reticlePos.s * 0.42, reticlePos.s * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(reticlePos.x, reticlePos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();

    // Laser Trajectory Nodes
    for (let i = 0; i < 14; i++) {
      const t = 0.08 + i * 0.070;
      const marker = project(
        position.x + dirX * speed * t,
        position.y + 8.25 * t - 0.5 * 17.2 * t * t,
        position.z + dirZ * speed * t
      );
      ctx.save();
      const nodePulse = Math.sin(time * 12 - i * 0.5) * 0.5 + 0.5;
      const alpha = (1 - i * 0.065) * (0.7 + 0.3 * nodePulse);
      ctx.globalAlpha = clamp(alpha, 0.1, 0.98);
      ctx.fillStyle = i < 8 ? '#62fff2' : '#c9adff';
      ctx.shadowColor = i < 8 ? '#40f5e8' : '#a68aff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, Math.max(1.8, 3.8 - i * 0.14), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Hyper-Realistic Translucent Gelatin with Fluid Dynamics, Viscous Nucleus & Glass Eyes
  function drawJelly() {
    const p = project(position.x, position.y, position.z);
    const palette = colors[tint];
    const baseR = p.s * 0.58;
    const scaleX = spring.value[0], scaleY = spring.value[1], scaleZ = spring.value[2];
    const radiusX = baseR * scaleX;
    const radiusY = baseR * 1.12 * scaleY;

    // Contact Surface Meniscus & Shadow Detection
    let floor = null;
    for (const pl of platformMap.values()) if (pl.index === currentPlatformIndex) floor = pl;
    const groundLevel = floor ? floor.surface + 0.55 : -999;
    const distToGround = Math.max(0, position.y - groundLevel);
    const onGround = distToGround < 0.12 && (state === 'idle' || state === 'aiming');

    // 1. Realistic Multi-Layer Ground Contact Shadows & Caustic Light Pool
    if (distToGround < 3.2 && floor) {
      const shadowSpot = project(position.x, floor.surface + 0.015, position.z);
      const shadowAlpha = clamp(1 - distToGround * 0.28, 0.18, 0.65);
      const shadowW = radiusX * (1 + distToGround * 0.18);
      const shadowH = radiusY * 0.28 * (1 + distToGround * 0.12);

      ctx.save();
      // Tight Ambient Occlusion Patch
      if (onGround) {
        ctx.fillStyle = 'rgba(2, 4, 12, 0.85)';
        ctx.beginPath();
        ctx.ellipse(shadowSpot.x, shadowSpot.y + 2, shadowW * 0.78, shadowH * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Diffused Directional Colored Drop Shadow
      const shadowGrad = ctx.createRadialGradient(shadowSpot.x, shadowSpot.y, 2, shadowSpot.x, shadowSpot.y, shadowW);
      shadowGrad.addColorStop(0, 'rgba(4, 7, 22, ' + shadowAlpha + ')');
      shadowGrad.addColorStop(0.55, palette.glow.replace(/[\d\.]+\)$/, (0.28 * shadowAlpha) + ')'));
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(shadowSpot.x + 3 * (1 - shadowAlpha), shadowSpot.y + 4, shadowW, shadowH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    // Directional In-Flight Tilt & Harmonic Fluid Wobble
    const tilt = clamp(velocity.x * 0.032, -0.25, 0.25);
    ctx.rotate(tilt);

    // 2. Volumetric Gelatin Body (Subsurface Light Transmission Gradient)
    const lx = -radiusX * 0.32, ly = -radiusY * 0.38;
    const bodyGrad = ctx.createRadialGradient(lx, ly, radiusX * 0.08, 0, radiusY * 0.08, radiusX * 1.25);
    bodyGrad.addColorStop(0, palette.highlight);
    bodyGrad.addColorStop(0.08, palette.core);
    bodyGrad.addColorStop(0.32, palette.outer);
    bodyGrad.addColorStop(0.68, palette.inner);
    bodyGrad.addColorStop(0.92, palette.deep);
    bodyGrad.addColorStop(1.0, palette.rim);

    // Outer Ambient Glow Bloom
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = onGround ? 22 : 28;

    // Organic Bézier Gelatin Contour (Squashes flat at bottom against platform surface)
    ctx.beginPath();
    const bottomFlatness = onGround ? radiusY * 0.22 : 0;
    ctx.moveTo(0, -radiusY);
    // Right Dome
    ctx.bezierCurveTo(radiusX * 0.95, -radiusY, radiusX * 1.05, radiusY * 0.45, radiusX * 0.90, radiusY - bottomFlatness);
    // Flat/Meniscus Bottom
    ctx.bezierCurveTo(radiusX * 0.45, radiusY + bottomFlatness * 0.2, -radiusX * 0.45, radiusY + bottomFlatness * 0.2, -radiusX * 0.90, radiusY - bottomFlatness);
    // Left Dome
    ctx.bezierCurveTo(-radiusX * 1.05, radiusY * 0.45, -radiusX * 0.95, -radiusY, 0, -radiusY);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Floating Luminescent Inner Nucleus (Secondary Spring Inertia)
    const nucX = clamp(nucleusLag.x, -radiusX * 0.22, radiusX * 0.22);
    const nucY = clamp(nucleusLag.y + radiusY * 0.08, -radiusY * 0.20, radiusY * 0.28);
    const nucR = radiusX * 0.42;
    const nucGrad = ctx.createRadialGradient(nucX, nucY, 1, nucX, nucY, nucR);
    nucGrad.addColorStop(0, palette.core);
    nucGrad.addColorStop(0.45, palette.outer);
    nucGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = nucGrad;
    ctx.beginPath();
    ctx.arc(nucX, nucY, nucR, 0, Math.PI * 2);
    ctx.fill();

    // 4. Inner Translucent Volume & Crisp Specular Rim
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.ellipse(0, radiusY * 0.10, radiusX * 0.78, radiusY * 0.74, -0.05, 0, Math.PI * 2);
    const innerSheen = ctx.createRadialGradient(-radiusX * 0.2, -radiusY * 0.05, 1, 0, radiusY * 0.1, radiusX * 0.95);
    innerSheen.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    innerSheen.addColorStop(0.6, palette.outer);
    innerSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = innerSheen;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Razor-Sharp Fresnel Edge Stroke
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX * 0.98, radiusY * 0.98, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Curved Glass Specular Highlights (Key Light + Opposing Rim Glint)
    // Primary Curved Glass Droplet at Upper-Left
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.ellipse(-radiusX * 0.36, -radiusY * 0.48, radiusX * 0.26, radiusY * 0.11, -0.62, 0, Math.PI * 2);
    ctx.fill();

    // Secondary Pinpoint Glint
    ctx.beginPath();
    ctx.arc(-radiusX * 0.14, -radiusY * 0.58, Math.max(2.2, radiusX * 0.055), 0, Math.PI * 2);
    ctx.fill();

    // Subtle Opposing Rim Crescent
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(radiusX * 0.35, -radiusY * 0.25, radiusX * 0.18, -0.7, 0.7);
    ctx.stroke();

    // 6. Glistening 3D Animated Eyes & Rosy Cheeks
    const eyeY = radiusY * 0.06;
    const eyeDX = radiusX * 0.30;
    const eyeR = Math.max(5.2, radiusX * 0.155);
    const eyeH = eyeR * 1.32;
    const isPanicking = $('avatar-widget').classList.contains('is-panicking');
    const isAiming = state === 'aiming';

    for (const sign of [-1, 1]) {
      const ex = sign * eyeDX;
      // 3D Glass Cornea & Deep Obsidian Pupil
      ctx.fillStyle = '#100f24';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR * 0.82, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cornea Catchlights (Primary Large Highlight + Secondary Bounce Reflection)
      ctx.fillStyle = '#ffffff';
      const lookDX = isAiming ? sign * 0.5 : 0;
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.28 + lookDX, eyeY - eyeH * 0.35, eyeR * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + eyeR * 0.22, eyeY + eyeH * 0.30, eyeR * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // Soft Subsurface Glowing Pink Blush
      const blushGrad = ctx.createRadialGradient(sign * radiusX * 0.54, radiusY * 0.30, 1, sign * radiusX * 0.54, radiusY * 0.30, radiusX * 0.18);
      blushGrad.addColorStop(0, 'rgba(255, 95, 160, 0.55)');
      blushGrad.addColorStop(1, 'rgba(255, 95, 160, 0)');
      ctx.fillStyle = blushGrad;
      ctx.beginPath();
      ctx.ellipse(sign * radiusX * 0.54, radiusY * 0.30, radiusX * 0.18, radiusY * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dynamic Expressive Mouth
    ctx.strokeStyle = '#282046';
    ctx.lineWidth = Math.max(2.2, radiusX * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (isPanicking) {
      ctx.ellipse(0, radiusY * 0.40, radiusX * 0.14, radiusY * 0.10, 0, 0, Math.PI * 2);
    } else if (isAiming) {
      ctx.moveTo(-radiusX * 0.11, radiusY * 0.36);
      ctx.lineTo(0, radiusY * 0.32);
      ctx.lineTo(radiusX * 0.11, radiusY * 0.36);
    } else {
      ctx.moveTo(-radiusX * 0.11, radiusY * 0.37);
      ctx.quadraticCurveTo(0, radiusY * 0.47, radiusX * 0.11, radiusY * 0.37);
    }
    ctx.stroke();

    ctx.restore();
  }

  function path(points) {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  function drawParticles() {
    for (const part of particles) {
      const p = project(part.x, part.y, part.z);
      const pal = colors[part.tint || tint];
      ctx.save();
      ctx.globalAlpha = clamp(part.life, 0, 1);
      ctx.shadowColor = pal.glow;
      ctx.shadowBlur = 14;
      const g = ctx.createRadialGradient(p.x - 2, p.y - 2, 0.1, p.x, p.y, 7);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, pal.outer);
      g.addColorStop(1, pal.inner);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 4.5 + part.life * 3.5, 6.5 + part.life * 2.5, part.vx * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function render() {
    const width = innerWidth, height = innerHeight;
    ctx.clearRect(0, 0, width, height);
    drawBackground(width, height);
    const list = Array.from(platformMap.values()).sort((a, b) => b.index - a.index);
    for (const p of list) drawPlatform(p);
    drawTrajectory();
    if (!jellyPopped) drawJelly();
    drawParticles();
    if (state === 'flying') {
      const fx = project(position.x, position.y, position.z);
      const sheen = ctx.createRadialGradient(fx.x, fx.y, 1, fx.x, fx.y, 65);
      sheen.addColorStop(0, 'rgba(64, 245, 232, 0.08)');
      sheen.addColorStop(1, 'rgba(64, 245, 232, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(fx.x - 65, fx.y - 65, 130, 130);
    }
  }

  function drawFrame(now) {
    const dt = Math.min(0.034, Math.max(0, (now - (lastFrame || now)) / 1000));
    lastFrame = now;
    if (!hidden) {
      time += dt;
      if (active && state === 'flying') updateFlight(dt);
      updateSpring(dt);
      updateParticles(dt);
      render();
    }
    requestAnimationFrame(drawFrame);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Multi-spectral realistic starfield (Blue giants, warm yellow, cool dwarfs, hero cross stars)
    const starColors = ['rgba(175, 215, 255, 0.90)', 'rgba(255, 235, 175, 0.88)', 'rgba(64, 245, 232, 0.92)', 'rgba(255, 175, 215, 0.85)'];
    stars = Array.from({ length: 140 }, (_, idx) => ({
      x: Math.random(), y: Math.random(),
      r: 0.35 + Math.random() * 1.55,
      speed: 0.35 + Math.random() * 1.35,
      phase: Math.random() * Math.PI * 2,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      hero: idx < 12 // 12 bright stars with cross-diffraction spikes
    }));

    // Ambient floating cosmic dust motes
    motes = Array.from({ length: 28 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 1.2 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -0.015 - Math.random() * 0.025,
      speed: 0.4 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() < 0.5 ? 'rgba(64, 245, 232, 0.35)' : 'rgba(180, 150, 255, 0.30)'
    }));

    render();
  }

  // YouTube Playables & System One Integration Hooks
  const ytSDK = window.YTPlayables || window.ytplayables || null;
  if (ytSDK && typeof ytSDK.firstFrameReady === 'function') {
    try { ytSDK.firstFrameReady(); } catch { /* Optional host hook */ }
  }
  if (ytSDK && typeof ytSDK.onPause === 'function') ytSDK.onPause(pauseGame);
  if (ytSDK && typeof ytSDK.onResume === 'function') ytSDK.onResume(pauseGame);

  // Desktop & YouTube Playables Keyboard Navigation
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!started || state === 'gameover') {
        if (state === 'gameover') resetWorld();
        startGame();
      }
    } else if (event.code === 'KeyP') {
      pauseGame();
    } else if (event.code === 'KeyM') {
      $('sound-button').click();
    }
  });

  $('play-button').addEventListener('click', startGame);
  $('retry-button').addEventListener('click', () => { resetWorld(); startGame(); });
  $('resume-button').addEventListener('click', pauseGame);
  $('pause-button').addEventListener('click', pauseGame);
  $('how-button').addEventListener('click', () => { $('how-modal').hidden = false; });
  $('pause-how-button').addEventListener('click', () => { $('how-modal').hidden = false; });
  $('close-how-button').addEventListener('click', () => { $('how-modal').hidden = true; });
  $('got-it-button').addEventListener('click', () => { $('how-modal').hidden = true; if (!started) startGame(); });
  $('how-modal').addEventListener('pointerdown', (event) => { if (event.target === $('how-modal')) $('how-modal').hidden = true; });
  $('sound-button').addEventListener('click', () => {
    soundMuted = !soundMuted;
    $('sound-button').textContent = soundMuted ? '×' : '♪';
    $('sound-button').setAttribute('aria-label', soundMuted ? 'Turn sound on' : 'Turn sound off');
    if (!soundMuted) unlockAudio();
    showToast(soundMuted ? 'SOUND OFF' : 'SOUND ON');
  });
  qsa('.tint-swatch').forEach((button) => button.addEventListener('click', () => chooseTint(button.dataset.tint)));
  $('leaderboard-button').hidden = true;
  window.addEventListener('resize', resize);
  window.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (audioContext) {
      if (hidden && audioContext.state === 'running') audioContext.suspend().catch(() => undefined);
      else if (!hidden && !soundMuted && audioContext.state === 'suspended') audioContext.resume().catch(() => undefined);
    }
  });

  resetWorld();
  chooseTint(tint);
  $('loading-screen').classList.add('is-done');
  resize();
  if (new URLSearchParams(location.search).get('autoplay') === '1') startGame();
  requestAnimationFrame(drawFrame);
})();
