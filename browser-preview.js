/*
 * Dependency-free offline preview of Jelly Jump.
 * The production source is the PlayCanvas/Vite TypeScript app under src/.
 * This preview draws the same soft-body fling loop in a perspective Canvas 2D renderer
 * so controls and UX can be tried when package-registry access is unavailable.
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

  const colors = {
    aqua: { outer: '#82f6e7', inner: '#3cc6d1', glow: 'rgba(68,255,228,.6)' },
    berry: { outer: '#ff9acb', inner: '#ee5d9b', glow: 'rgba(255,95,184,.55)' },
    lilac: { outer: '#d1b6ff', inner: '#8b74e9', glow: 'rgba(167,119,255,.58)' },
    sunshine: { outer: '#ffe6a2', inner: '#f5a83f', glow: 'rgba(255,204,89,.56)' }
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
  let platformMap = new Map();
  let particles = [];
  let stars = [];
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
  function project(x, y, z) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const unit = Math.min(width, height) * 0.155;
    const ahead = position.z - z;
    const depth = clamp(1 - ahead * 0.0125, 0.66, 1.16);
    const cameraX = position.x * 0.28;
    return {
      x: width * 0.5 + (x - cameraX) * unit * depth,
      y: height * 0.61 - (y - position.y) * unit * 0.92 - ahead * unit * 0.43,
      s: unit * depth
    };
  }
  function platformFor(index) {
    if (platformMap.has(index)) return platformMap.get(index);
    const x = index === 0 ? 0 : Math.sin(index * 1.29) * 0.93 + Math.sin(index * 0.43) * 0.19;
    const y = 0.22 + Math.sin(index * 0.77) * 0.22;
    const p = {
      index, x, y, z: -index * 4.05, surface: y + 0.20, width: 2.2, depth: 2.3,
      hazard: index >= 3 && index % 4 === 0, berryCollected: false
    };
    p.spikes = p.hazard ? [{ x: x - 0.50, y: p.surface + 0.30, z: p.z + 0.25 }, { x: x + 0.52, y: p.surface + 0.30, z: p.z - 0.42 }] : [];
    if (index > 0) p.berry = { x: x + 0.18, y: p.surface + 0.78, z: p.z + 0.05 };
    platformMap.set(index, p);
    return p;
  }
  function ensurePlatforms() {
    for (let i = 0; i <= currentPlatformIndex + 4; i++) platformFor(i);
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
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 1500);
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
    showToast(`${tint.toUpperCase()} JELLY EQUIPPED`);
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
      if (!audioContext) audioContext = new AudioContext({ latencyHint: 'interactive' });
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => undefined);
    } catch { /* Audio is optional. */ }
  }
  function boing(power = 0.5, impact = false) {
    if (soundMuted || !audioContext || audioContext.state !== 'running') return;
    try {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const freq = (impact ? 230 : 310) + clamp(power, 0, 1) * 170;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq * (impact ? 1.4 : 1.7), now);
      oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, now + (impact ? 0.18 : 0.24));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(impact ? 0.1 : 0.07, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now); oscillator.stop(now + 0.29);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio failures never block gameplay. */ }
  }
  function haptic() {
    if (navigator.userActivation && navigator.userActivation.hasBeenActive && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(25); } catch { /* Unsupported in some browsers. */ }
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
      let mx = gx * 0.79 + (tx / targetLen) * 0.21;
      let mz = gz * 0.79 + (tz / targetLen) * 0.21;
      const m = Math.hypot(mx, mz) || 1;
      dirX = mx / m; dirZ = mz / m;
    }
    const minDim = Math.max(1, Math.min(innerWidth, innerHeight));
    const power = distance < 12 ? 0.27 : clamp(distance / (minDim * 0.48), 0.08, 1);
    const speed = 4.65 + power * 2.55;
    velocity = { x: dirX * speed, y: 8.25, z: dirZ * speed };
    elapsed = 0; oldY = position.y; pull.start = null; pull.current = null; active = true;
    spring.target = [1.26, 0.65, 0.78];
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
    const ratio = clamp(distance / (minDim * 0.48), 0, 1);
    spring.target = [1 + ratio * 0.34, 1 - ratio * 0.24, 1 + ratio * 0.1];
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
    spring.target = [1.04, 0.94, 1];
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
    if (elapsed < 0.2) spring.target = [1.2, 0.72, 0.82];
    else if (elapsed < 0.46) spring.target = [0.83, 1.28, 0.82];
    else spring.target = [0.96, 1.02, 0.94];
    if (checkSpikeHit()) { popJelly(); return; }
    collectBerries();
    if (velocity.y <= 0 && landIfPossible()) return;
    if (position.y < -5.9 || elapsed > 2.3) popJelly();
  }
  function checkSpikeHit() {
    for (const p of platformMap.values()) {
      if (!p.hazard) continue;
      for (const s of p.spikes) {
        if (Math.abs(position.x - s.x) < 0.42 && Math.abs(position.z - s.z) < 0.43 && position.y - s.y > -0.35 && position.y - s.y < 0.76) return true;
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
      if (progressed) {
        levelsCleared += p.index - previous;
        ensurePlatforms();
        showToast(p.hazard ? 'CLEAN LANDING! WATCH THOSE SPIKES' : 'JUICY LANDING! +1 LEVEL');
      } else showToast('NICE SAVE — LINE UP THE NEXT BOUNCE');
      spring.target = [1.28, 0.57, 1.08];
      setState('idle');
      setPanic(false);
      boing(0.72, true); haptic();
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
      if ((position.x - bx) ** 2 + (position.y - by) ** 2 + (position.z - bz) ** 2 < 0.72 ** 2) {
        p.berryCollected = true;
        berries += 1;
        persist(); updateStats(); showToast('+1 JUICY BERRY');
      }
    }
  }
  function popJelly() {
    if (state !== 'flying') return;
    active = false;
    jellyPopped = true;
    setPanic(true, 1);
    boing(0.72, true); haptic();
    for (let i = 0; i < 18; i++) {
      const angle = Math.PI * 2 * i / 18 + Math.random() * 0.22;
      const speed = 1 + Math.random() * 3.2;
      particles.push({ x: position.x, y: position.y, z: position.z, vx: Math.cos(angle) * speed, vy: 1.1 + Math.random() * 4.1, vz: Math.sin(angle) * speed, life: .9 + Math.random() * .35 });
    }
    best = Math.max(best, levelsCleared);
    persist(); updateStats(); setState('gameover');
    showToast(levelsCleared > 0 ? `RUN COMPLETE • ${levelsCleared} LEVELS CLEARED` : 'THE JELLY HAS LEFT THE CHAT');
  }
  function updateSpring(dt) {
    const damping = .65;
    const omega = 2 * Math.PI / .38;
    for (let i = 0; i < 3; i++) {
      const acceleration = (spring.target[i] - spring.value[i]) * omega * omega - 2 * damping * omega * spring.speed[i];
      spring.speed[i] += acceleration * dt;
      spring.value[i] += spring.speed[i] * dt;
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt; p.vy -= 17.2 * .55 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBackground(w, h) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#171b49'); bg.addColorStop(.42, '#151943'); bg.addColorStop(1, '#080b21');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    let glow = ctx.createRadialGradient(w * .18, h * .39, 2, w * .18, h * .39, w * .67);
    glow.addColorStop(0, 'rgba(107,72,203,.24)'); glow.addColorStop(1, 'rgba(107,72,203,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    glow = ctx.createRadialGradient(w * .85, h * .42, 2, w * .85, h * .42, w * .55);
    glow.addColorStop(0, 'rgba(43,206,203,.15)'); glow.addColorStop(1, 'rgba(43,206,203,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    ctx.save();
    for (const star of stars) {
      const twinkle = .24 + .42 * (Math.sin(time * star.speed + star.phase) * .5 + .5);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = star.color;
      ctx.beginPath(); ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawPlatform(p) {
    const halfW = p.width / 2, halfD = p.depth / 2;
    const corners = [
      project(p.x - halfW, p.surface, p.z - halfD),
      project(p.x + halfW, p.surface, p.z - halfD),
      project(p.x + halfW, p.surface, p.z + halfD),
      project(p.x - halfW, p.surface, p.z + halfD)
    ];
    const extrusion = 13 * (corners.reduce((sum, c) => sum + c.s, 0) / corners.length) / (Math.min(innerWidth, innerHeight) * .155);
    ctx.save();
    // Under-platform bloom and the dark beveled side wall.
    ctx.shadowColor = p.hazard ? 'rgba(255,70,125,.30)' : 'rgba(71,247,224,.32)';
    ctx.shadowBlur = 19;
    ctx.fillStyle = 'rgba(13,23,59,.96)';
    path(corners); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(corners[3].x, corners[3].y); ctx.lineTo(corners[2].x, corners[2].y); ctx.lineTo(corners[2].x, corners[2].y + extrusion); ctx.lineTo(corners[3].x, corners[3].y + extrusion); ctx.closePath();
    const side = ctx.createLinearGradient(corners[3].x, corners[3].y, corners[3].x, corners[3].y + extrusion);
    side.addColorStop(0, '#14364e'); side.addColorStop(1, '#111a39'); ctx.fillStyle = side; ctx.fill();
    ctx.beginPath(); ctx.moveTo(corners[2].x, corners[2].y); ctx.lineTo(corners[1].x, corners[1].y); ctx.lineTo(corners[1].x, corners[1].y + extrusion); ctx.lineTo(corners[2].x, corners[2].y + extrusion); ctx.closePath();
    ctx.fillStyle = '#0b1536'; ctx.fill();
    path(corners);
    const topGradient = ctx.createLinearGradient(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
    topGradient.addColorStop(0, '#244e79'); topGradient.addColorStop(.45, '#163c61'); topGradient.addColorStop(1, '#122c4c');
    ctx.fillStyle = topGradient; ctx.fill();
    ctx.lineWidth = 1.25; ctx.strokeStyle = p.hazard ? 'rgba(255,112,154,.98)' : 'rgba(124,250,230,.92)'; ctx.shadowColor = p.hazard ? '#ff4e87' : '#53f5dc'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    // Glassy runway rings and top-facing seams.
    const c = project(p.x, p.surface + .04, p.z);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.s * .72, c.s * .31, 0, 0, Math.PI * 2);
    ctx.strokeStyle = p.hazard ? 'rgba(255,115,155,.45)' : 'rgba(112,255,230,.38)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.s * .48, c.s * .21, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(189,249,255,.17)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    if (p.hazard) p.spikes.forEach(drawSpike);
    if (p.berry && !p.berryCollected) {
      const bob = prefersReducedMotion ? 0 : Math.sin(time * 2.2 + p.index) * .08;
      const berry = project(p.berry.x, p.berry.y + bob, p.berry.z);
      drawBerry(berry, p.index);
    }
  }
  function drawSpike(s) {
    const base = project(s.x, s.y - .31, s.z), top = project(s.x, s.y + .38, s.z), left = project(s.x - .23, s.y - .31, s.z + .1), right = project(s.x + .23, s.y - .31, s.z + .1);
    ctx.save(); ctx.shadowColor = 'rgba(255,66,124,.9)'; ctx.shadowBlur = 12;
    const g = ctx.createLinearGradient(top.x, top.y, base.x, base.y); g.addColorStop(0, '#ffe0f0'); g.addColorStop(.2, '#ff79ad'); g.addColorStop(1, '#e33475');
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(base.x, base.y); ctx.lineTo(left.x, left.y); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,222,240,.8)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  }
  function drawBerry(p, phase) {
    const bob = Math.sin(time * 2 + phase) * 1.8;
    const r = Math.max(6, p.s * .19);
    ctx.save();
    ctx.globalAlpha = .55; ctx.strokeStyle = '#ff8dbf'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + bob, r * 1.55, r * .55, time * .5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowColor = '#ffba69'; ctx.shadowBlur = 20;
    const grad = ctx.createRadialGradient(p.x - r * .3, p.y - r * .45 + bob, 1, p.x, p.y + bob, r * 1.45);
    grad.addColorStop(0, '#fffbd3'); grad.addColorStop(.28, '#ffe6a1'); grad.addColorStop(.68, '#ffbd6c'); grad.addColorStop(1, '#ff739e');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y + bob, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(p.x - r * .3, p.y - r * .35 + bob, r * .19, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawTrajectory() {
    if (state !== 'aiming' || !pull.start || !pull.current) return;
    const dx = pull.current.x - pull.start.x, dy = pull.current.y - pull.start.y;
    const distance = Math.hypot(dx, dy), target = platformFor(currentPlatformIndex + 1), from = platformFor(currentPlatformIndex);
    let dirX = (target.x - position.x) / 4.05, dirZ = (target.z - position.z) / 4.05;
    if (distance > 12) {
      const len = Math.hypot(dx, dy) || 1;
      dirX = (-dx / len) * .79 + dirX * .21; dirZ = (-dy / len) * .79 + dirZ * .21;
      const ll = Math.hypot(dirX, dirZ) || 1; dirX /= ll; dirZ /= ll;
    } else { const ll = Math.hypot(dirX, dirZ) || 1; dirX /= ll; dirZ /= ll; }
    const power = distance < 12 ? .27 : clamp(distance / (Math.min(innerWidth, innerHeight) * .48), .08, 1);
    const speed = 4.65 + power * 2.55;
    for (let i = 0; i < 12; i++) {
      const t = .09 + i * .075;
      const marker = project(position.x + dirX * speed * t, position.y + 8.25 * t - .5 * 17.2 * t * t, position.z + dirZ * speed * t);
      ctx.save(); ctx.globalAlpha = .95 - i * .045; ctx.fillStyle = i < 7 ? '#9bfff0' : '#c9adff'; ctx.shadowColor = i < 7 ? '#4effdc' : '#a68aff'; ctx.shadowBlur = 11;
      ctx.beginPath(); ctx.arc(marker.x, marker.y, Math.max(1.7, 3.5 - i * .12), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  function drawJelly() {
    const p = project(position.x, position.y, position.z);
    const scaleX = spring.value[0], scaleY = spring.value[1], scaleZ = spring.value[2];
    const radiusX = p.s * .55 * scaleX;
    const radiusY = p.s * .66 * scaleY;
    // A grounded, diffused shadow tells the eye how far the jelly is from the platform.
    let floor = null;
    for (const pl of platformMap.values()) if (pl.index === currentPlatformIndex) floor = pl;
    if (floor) {
      const shadow = project(position.x, floor.surface + .015, position.z);
      const shadowAlpha = clamp(1 - Math.max(0, position.y - (floor.surface + .55)) * .12, .22, .55);
      ctx.save(); ctx.globalAlpha = shadowAlpha; ctx.fillStyle = '#05091b'; ctx.filter = 'blur(5px)';
      ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y + 4, radiusX * 1.35, radiusY * .25, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(clamp(velocity.x * .025, -.12, .12));
    ctx.scale(1, 1);
    const palette = colors[tint];
    const bodyGradient = ctx.createRadialGradient(-radiusX * .34, -radiusY * .47, 1, radiusX * .06, radiusY * .1, radiusX * 1.26);
    bodyGradient.addColorStop(0, '#ffffff'); bodyGradient.addColorStop(.09, palette.outer); bodyGradient.addColorStop(.40, palette.outer); bodyGradient.addColorStop(.75, palette.inner); bodyGradient.addColorStop(1, tint === 'aqua' ? 'rgba(35,98,184,.78)' : 'rgba(78,49,150,.76)');
    ctx.shadowColor = palette.glow; ctx.shadowBlur = 19;
    ctx.beginPath(); ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2); ctx.fillStyle = bodyGradient; ctx.fill(); ctx.shadowBlur = 0;
    // Inner translucent volume and a crisp specular rim make the jelly feel glassy.
    ctx.globalAlpha = .4; ctx.beginPath(); ctx.ellipse(0, radiusY * .12, radiusX * .75, radiusY * .75, -.06, 0, Math.PI * 2);
    const inner = ctx.createRadialGradient(-radiusX * .2, -radiusY * .03, 1, 0, radiusY * .1, radiusX);
    inner.addColorStop(0, 'rgba(255,255,255,.7)'); inner.addColorStop(1, palette.inner); ctx.fillStyle = inner; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(0, 0, radiusX * .985, radiusY * .985, 0, 0, Math.PI * 2); ctx.stroke();
    // Large shiny eyes, blush and a tiny nervous smile.
    const eyeY = radiusY * .08, eyeDX = radiusX * .29, eyeR = Math.max(4.5, radiusX * .145);
    for (const sign of [-1, 1]) {
      ctx.fillStyle = 'rgba(32,30,70,.98)'; ctx.beginPath(); ctx.ellipse(sign * eyeDX, eyeY, eyeR * .78, eyeR * 1.02, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.97)'; ctx.beginPath(); ctx.arc(sign * eyeDX - eyeR * .24, eyeY - eyeR * .34, eyeR * .23, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,108,171,.48)'; ctx.beginPath(); ctx.ellipse(sign * radiusX * .52, radiusY * .31, radiusX * .14, radiusY * .07, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#312958'; ctx.lineWidth = Math.max(2, radiusX * .055); ctx.lineCap = 'round'; ctx.beginPath();
    if (state === 'aiming' && pull.length > Math.min(innerWidth, innerHeight) * .25) {
      ctx.moveTo(-radiusX * .12, radiusY * .37); ctx.lineTo(0, radiusY * .32); ctx.lineTo(radiusX * .12, radiusY * .37);
    } else {
      ctx.moveTo(-radiusX * .105, radiusY * .38); ctx.quadraticCurveTo(0, radiusY * .47, radiusX * .105, radiusY * .38);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-radiusX * .38, -radiusY * .54, radiusX * .15, radiusY * .055, -.53, 0, Math.PI * 2); ctx.fill();
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
      ctx.save(); ctx.globalAlpha = clamp(part.life, 0, 1); ctx.shadowColor = colors[tint].glow; ctx.shadowBlur = 12;
      const g = ctx.createRadialGradient(p.x - 2, p.y - 3, .1, p.x, p.y, 7);
      g.addColorStop(0, '#fff'); g.addColorStop(.35, colors[tint].outer); g.addColorStop(1, colors[tint].inner);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, 4 + part.life * 3, 6 + part.life * 2, part.vx * .08, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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
      const sheen = ctx.createRadialGradient(fx.x, fx.y, 1, fx.x, fx.y, 54);
      sheen.addColorStop(0, 'rgba(111,248,224,.06)'); sheen.addColorStop(1, 'rgba(111,248,224,0)');
      ctx.fillStyle = sheen; ctx.fillRect(fx.x - 55, fx.y - 55, 110, 110);
    }
  }
  function drawFrame(now) {
    const dt = Math.min(.034, Math.max(0, (now - (lastFrame || now)) / 1000));
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: 78 }, () => ({
      x: Math.random(), y: Math.random(), r: .35 + Math.random() * 1.35,
      speed: .35 + Math.random() * 1.25, phase: Math.random() * Math.PI * 2,
      color: Math.random() < .5 ? 'rgba(181,213,255,.8)' : 'rgba(150,255,238,.9)'
    }));
    render();
  }

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
