import {
  Application,
  BLEND_NORMAL,
  Color,
  Entity,
  FILLMODE_FILL_WINDOW,
  RESOLUTION_AUTO,
  StandardMaterial,
  Vec3
} from 'playcanvas';
import { transition, type GameEvent, type GameState } from './state';
import type { JellyTint, LensSave } from '../host/snapRouter';

const GRAVITY = -17.2;
const JUMP_VERTICAL = 8.25;
const PLATFORM_GAP = 4.05;
const BODY_LAND_HEIGHT = 0.55;
const TINTS: Record<JellyTint, { outer: [number, number, number]; inner: [number, number, number]; glow: [number, number, number] }> = {
  aqua: { outer: [0.40, 0.96, 0.91], inner: [0.20, 0.76, 0.82], glow: [0.10, 0.47, 0.48] },
  berry: { outer: [1.00, 0.53, 0.76], inner: [0.91, 0.30, 0.63], glow: [0.50, 0.08, 0.27] },
  lilac: { outer: [0.76, 0.65, 1.00], inner: [0.51, 0.40, 0.91], glow: [0.26, 0.14, 0.58] },
  sunshine: { outer: [1.00, 0.86, 0.53], inner: [0.94, 0.60, 0.20], glow: [0.48, 0.26, 0.04] }
};

interface GameHooks {
  onState(state: GameState): void;
  onStats(stats: { level: number; berries: number; best: number; cleared: number }): void;
  onPanic(panicking: boolean, pull: number): void;
  onToast(message: string): void;
  onImpact(): void;
  onLaunch(power: number): void;
  onGameOver(score: number): void;
  onTint(tint: JellyTint): void;
  onBerry(berries: number): void;
}

interface PlatformData {
  index: number;
  x: number;
  y: number;
  z: number;
  surface: number;
  width: number;
  depth: number;
  hazard: boolean;
  entity: Entity;
  cap: Entity;
  ring: Entity;
  berry?: Entity;
  berryRing?: Entity;
  berryCollected: boolean;
  spikes: Array<{ entity: Entity; x: number; y: number; z: number }>;
  extras: Entity[];
}

interface Particle {
  entity: Entity;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface Spring3 {
  value: [number, number, number];
  velocity: [number, number, number];
  target: [number, number, number];
}

export class JellyJumpGame {
  readonly app: Application;
  private readonly canvas: HTMLCanvasElement;
  private readonly hooks: GameHooks;
  private state: GameState = { tag: 'BOOT' };
  private active = false;
  private hidden = false;
  private platforms = new Map<number, PlatformData>();
  private particles: Particle[] = [];
  private starfield: Array<{ entity: Entity; baseY: number; phase: number; speed: number }> = [];
  private player!: Entity;
  private outerBody!: Entity;
  private innerBody!: Entity;
  private faceEyes: Entity[] = [];
  private camera!: Entity;
  private cameraPosition = new Vec3(0, 6.2, 11.5);
  private bodyMaterial!: StandardMaterial;
  private innerMaterial!: StandardMaterial;
  private cheekMaterial!: StandardMaterial;
  private dotEntities: Entity[] = [];
  private dotMaterials: StandardMaterial[] = [];
  private jellySpring: Spring3 = { value: [1, 1, 1], velocity: [0, 0, 0], target: [1, 1, 1] };
  private tint: JellyTint = 'aqua';
  private berries = 0;
  private best = 0;
  private currentPlatformIndex = 0;
  private levelsCleared = 0;
  private position = new Vec3(0, 1, 0);
  private velocity = new Vec3(0, 0, 0);
  private oldY = 0;
  private pointerStart: { x: number; y: number } | null = null;
  private pointerCurrent: { x: number; y: number } | null = null;
  private pullLength = 0;
  private elapsed = 0;
  private impactFlash = 0;
  private wobbleClock = 0;
  private readonly reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly starMaterial = makeMaterial([0.62, 0.75, 1], { emissive: [0.35, 0.40, 0.8], opacity: 0.92, gloss: 80 });
  private readonly platformSide = makeMaterial([0.07, 0.12, 0.30], { emissive: [0.02, 0.04, 0.12], gloss: 88 });
  private readonly platformTop = makeMaterial([0.17, 0.41, 0.57], { emissive: [0.04, 0.23, 0.32], gloss: 96 });
  private readonly platformRing = makeMaterial([0.38, 0.96, 0.86], { emissive: [0.12, 0.75, 0.66], gloss: 95 });
  private readonly spikeMaterial = makeMaterial([1.0, 0.24, 0.44], { emissive: [0.86, 0.04, 0.18], gloss: 88 });
  private readonly berryMaterial = makeMaterial([1.0, 0.81, 0.39], { emissive: [0.78, 0.32, 0.06], gloss: 100 });
  private readonly berryRingMaterial = makeMaterial([1.0, 0.58, 0.74], { emissive: [0.92, 0.18, 0.42], gloss: 92 });
  private readonly mouthMaterial = makeMaterial([0.06, 0.08, 0.20], { gloss: 72 });
  private readonly eyeMaterial = makeMaterial([0.05, 0.07, 0.16], { gloss: 100 });
  private readonly eyeGlintMaterial = makeMaterial([1, 1, 1], { emissive: [0.8, 0.95, 1], gloss: 100 });
  private readonly dotMatA = makeMaterial([0.64, 1, 0.94], { emissive: [0.26, 0.95, 0.86], opacity: 0.84, gloss: 94 });
  private readonly dotMatB = makeMaterial([0.82, 0.77, 1], { emissive: [0.45, 0.33, 0.97], opacity: 0.65, gloss: 90 });

  constructor(canvas: HTMLCanvasElement, hooks: GameHooks, save: LensSave) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.berries = save.berries;
    this.best = save.bestScore;
    this.tint = save.tint;
    this.app = new Application(canvas);
    this.app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(RESOLUTION_AUTO);
    this.app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
    this.app.scene.ambientLight = new Color(0.26, 0.31, 0.55);
    this.app.scene.exposure = 1.13;
    this.createLighting();
    this.createCamera();
    this.createEnvironment();
    this.createJelly();
    this.createTrajectoryDots();
    this.setTint(this.tint, false);
    this.rebuildPlatforms();
    this.setPlayerToPlatform(0);
    this.state = transition(this.state, { type: 'READY' });
    this.hooks.onState(this.state);
    this.emitStats();
    this.app.on('update', this.update);
    this.app.start();
    this.bindInput();
    window.addEventListener('resize', this.onResize);
  }

  get currentState(): GameState { return this.state; }
  get currentTint(): JellyTint { return this.tint; }
  get currentBerries(): number { return this.berries; }
  get bestScore(): number { return this.best; }
  get score(): number { return this.levelsCleared; }
  get currentLevel(): number { return this.currentPlatformIndex + 1; }

  startRun(): void {
    if (this.state.tag === 'GAMEOVER') this.send({ type: 'REPLAY' });
    this.active = true;
    this.hidden = false;
    if (this.state.tag === 'PAUSED') this.send({ type: 'RESUME' });
    if (this.state.tag !== 'IDLE') this.state = { tag: 'IDLE' };
    this.hooks.onState(this.state);
    this.hooks.onToast('PULL BACK • LET GO • LAND SOFT');
    this.emitStats();
  }

  replay(): void {
    if (this.state.tag !== 'GAMEOVER') return;
    this.send({ type: 'REPLAY' });
    this.levelsCleared = 0;
    this.currentPlatformIndex = 0;
    this.elapsed = 0;
    this.velocity.set(0, 0, 0);
    this.pointerStart = null;
    this.pointerCurrent = null;
    this.pullLength = 0;
    this.destroyParticles();
    this.rebuildPlatforms();
    this.setPlayerToPlatform(0);
    this.active = true;
    this.setSpringTarget([1, 1, 1]);
    this.setDotsVisible(false);
    this.hooks.onPanic(false, 0);
    this.emitStats();
    this.hooks.onState(this.state);
  }

  pause(): void {
    if (this.state.tag === 'IDLE' || this.state.tag === 'AIMING' || this.state.tag === 'FLYING') {
      if (this.state.tag === 'AIMING') this.cancelAim();
      this.send({ type: 'PAUSE' });
      this.hooks.onState(this.state);
    }
  }

  resume(): void {
    if (this.state.tag === 'PAUSED') {
      this.send({ type: 'RESUME' });
      this.hooks.onState(this.state);
    }
  }

  setTint(tint: JellyTint, notify = true): void {
    this.tint = tint in TINTS ? tint : 'aqua';
    const palette = TINTS[this.tint];
    this.bodyMaterial.diffuse = color(palette.outer);
    this.bodyMaterial.emissive = color(palette.glow.map((value) => value * 0.48) as [number, number, number]);
    this.bodyMaterial.update();
    this.innerMaterial.diffuse = color(palette.inner);
    this.innerMaterial.emissive = color(palette.glow);
    this.innerMaterial.update();
    if (notify) this.hooks.onTint(this.tint);
    if (notify) this.hooks.onToast(`${this.tint.toUpperCase()} JELLY EQUIPPED`);
  }

  setVisibilityPaused(paused: boolean): void {
    this.hidden = paused;
    this.pointerStart = null;
    this.pointerCurrent = null;
    if (paused && this.state.tag === 'AIMING') this.cancelAim();
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.app.destroy();
  }

  private readonly onResize = (): void => {
    this.app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
    this.app.resizeCanvas();
  };

  private send(event: GameEvent): void {
    const previous = this.state;
    this.state = transition(this.state, event);
    if (previous !== this.state) this.hooks.onState(this.state);
  }

  private createLighting(): void {
    const key = new Entity('softbox-key');
    key.addComponent('light', { type: 'directional', color: new Color(0.73, 0.88, 1), intensity: 1.45 });
    key.setEulerAngles(42, 28, -17);
    this.app.root.addChild(key);

    const rim = new Entity('rose-rim-light');
    rim.addComponent('light', { type: 'directional', color: new Color(0.76, 0.35, 1), intensity: 0.8 });
    rim.setEulerAngles(-28, 154, 18);
    this.app.root.addChild(rim);

    const fill = new Entity('mint-fill-light');
    fill.addComponent('light', { type: 'directional', color: new Color(0.28, 1, 0.85), intensity: 0.48 });
    fill.setEulerAngles(18, -82, 0);
    this.app.root.addChild(fill);
  }

  private createCamera(): void {
    this.camera = new Entity('lens-camera');
    this.camera.addComponent('camera', {
      clearColor: new Color(0.035, 0.043, 0.105),
      fov: 47,
      nearClip: 0.1,
      farClip: 160
    });
    this.camera.setPosition(0, 6.2, 11.5);
    this.camera.lookAt(new Vec3(0, 1.2, -3.3));
    this.app.root.addChild(this.camera);
  }

  private createEnvironment(): void {
    const nebulaA = makeMaterial([0.09, 0.13, 0.36], { emissive: [0.06, 0.04, 0.22], opacity: 0.72, gloss: 30 });
    const nebulaB = makeMaterial([0.12, 0.29, 0.45], { emissive: [0.02, 0.17, 0.24], opacity: 0.42, gloss: 26 });
    for (let i = 0; i < 13; i += 1) {
      const x = Math.sin(i * 7.31) * 10.5;
      const y = -1.6 + ((i * 1.71) % 10.5);
      const z = -6 - ((i * 4.7) % 46);
      const orb = this.mesh('sphere', i % 2 === 0 ? nebulaA : nebulaB, new Vec3(x, y, z), new Vec3(0.4 + (i % 3) * 0.23, 0.4 + (i % 3) * 0.23, 0.4 + (i % 3) * 0.23), `distant-nebula-${i}`);
      this.starfield.push({ entity: orb, baseY: y, phase: i * 0.75, speed: 0.17 + (i % 4) * 0.035 });
    }
    for (let i = 0; i < 72; i += 1) {
      const x = (Math.random() - 0.5) * 23;
      const y = -2 + Math.random() * 12.5;
      const z = 5 - Math.random() * 58;
      const radius = 0.018 + Math.random() * 0.034;
      const star = this.mesh('sphere', this.starMaterial, new Vec3(x, y, z), new Vec3(radius, radius, radius), `star-${i}`);
      this.starfield.push({ entity: star, baseY: y, phase: i * 0.71, speed: 0.2 + Math.random() * 0.33 });
    }
    const farGlowMat = makeMaterial([0.18, 0.18, 0.48], { emissive: [0.1, 0.08, 0.42], opacity: 0.25, gloss: 20 });
    this.mesh('sphere', farGlowMat, new Vec3(-8, 5.5, -24), new Vec3(3.3, 3.3, 3.3), 'far-violet-glow');
    this.mesh('sphere', nebulaB, new Vec3(8.8, 1.4, -18), new Vec3(2.1, 2.1, 2.1), 'far-teal-glow');
  }

  private createJelly(): void {
    this.player = new Entity('jelly-root');
    this.app.root.addChild(this.player);
    this.bodyMaterial = makeMaterial([0.4, 0.96, 0.91], { emissive: [0.05, 0.21, 0.23], opacity: 0.66, gloss: 100, depthWrite: false });
    this.innerMaterial = makeMaterial([0.2, 0.76, 0.82], { emissive: [0.1, 0.33, 0.39], opacity: 0.36, gloss: 100, depthWrite: false });
    this.cheekMaterial = makeMaterial([1, 0.36, 0.65], { emissive: [0.22, 0.03, 0.1], opacity: 0.68, gloss: 86, depthWrite: false });
    this.outerBody = this.mesh('sphere', this.bodyMaterial, new Vec3(0, 0, 0), new Vec3(0.69, 0.71, 0.65), 'jelly-glass-shell', this.player);
    this.innerBody = this.mesh('sphere', this.innerMaterial, new Vec3(0, -0.035, -0.018), new Vec3(0.56, 0.58, 0.52), 'jelly-inner-glow', this.player);

    // Large dark, glossy eyes and their pin-point highlights keep the face readable on phones.
    for (const side of [-1, 1]) {
      const eye = this.mesh('sphere', this.eyeMaterial, new Vec3(side * 0.205, 0.105, 0.545), new Vec3(0.112, 0.134, 0.075), `jelly-eye-${side}`, this.player);
      const glint = this.mesh('sphere', this.eyeGlintMaterial, new Vec3(side * 0.205 - 0.027, 0.151, 0.607), new Vec3(0.033, 0.04, 0.02), `jelly-eye-glint-${side}`, this.player);
      const cheek = this.mesh('sphere', this.cheekMaterial, new Vec3(side * 0.35, -0.05, 0.48), new Vec3(0.105, 0.062, 0.028), `jelly-cheek-${side}`, this.player);
      this.faceEyes.push(eye, glint, cheek);
    }
    this.mesh('sphere', this.mouthMaterial, new Vec3(0, -0.18, 0.573), new Vec3(0.095, 0.027, 0.025), 'jelly-smile', this.player);
    // Gloss streak over the upper left side, like a studio softbox reflection.
    this.mesh('sphere', this.eyeGlintMaterial, new Vec3(-0.23, 0.39, 0.43), new Vec3(0.11, 0.038, 0.024), 'jelly-shell-highlight', this.player);
  }

  private createTrajectoryDots(): void {
    for (let i = 0; i < 12; i += 1) {
      const radius = 0.045 - i * 0.0019;
      const entity = this.mesh('sphere', i < 7 ? this.dotMatA : this.dotMatB, new Vec3(0, -100, 0), new Vec3(radius, radius, radius), `trajectory-dot-${i}`);
      entity.enabled = false;
      this.dotEntities.push(entity);
      this.dotMaterials.push(i < 7 ? this.dotMatA : this.dotMatB);
    }
  }

  private rebuildPlatforms(): void {
    for (const platform of this.platforms.values()) {
      platform.entity.destroy();
      platform.cap.destroy();
      platform.ring.destroy();
      platform.extras.forEach((extra) => extra.destroy());
      platform.spikes.forEach((spike) => spike.entity.destroy());
      platform.berry?.destroy();
      platform.berryRing?.destroy();
    }
    this.platforms.clear();
    for (let i = 0; i < 5; i += 1) this.createPlatform(i);
  }

  private createPlatform(index: number): PlatformData {
    const x = index === 0 ? 0 : Math.sin(index * 1.29) * 0.93 + Math.sin(index * 0.43) * 0.19;
    const y = 0.22 + Math.sin(index * 0.77) * 0.22;
    const z = -index * PLATFORM_GAP;
    const width = 2.2;
    const depth = 2.3;
    const surface = y + 0.20;
    const entity = this.mesh('box', this.platformSide, new Vec3(x, y, z), new Vec3(width, 0.38, depth), `platform-${index}`);
    const cap = this.mesh('box', this.platformTop, new Vec3(x, surface, z), new Vec3(width * 0.96, 0.055, depth * 0.96), `platform-cap-${index}`);
    const ring = this.mesh('torus', this.platformRing, new Vec3(x, surface + 0.06, z), new Vec3(0.82, 0.055, 0.82), `platform-ring-${index}`);
    ring.setEulerAngles(90, 0, 0);
    const extras: Entity[] = [];
    for (let s = -1; s <= 1; s += 2) {
      const seam = this.mesh('box', this.platformRing, new Vec3(x + s * (width * 0.44), y - 0.05, z), new Vec3(0.035, 0.16, depth * 0.75), `platform-seam-${index}-${s}`);
      extras.push(seam);
    }
    const hazard = index >= 3 && index % 4 === 0;
    const spikes: PlatformData['spikes'] = [];
    if (hazard) {
      for (let s = 0; s < 2; s += 1) {
        const sx = x + (s === 0 ? -0.50 : 0.52);
        const sz = z + (s === 0 ? 0.25 : -0.42);
        const spike = this.mesh('cone', this.spikeMaterial, new Vec3(sx, surface + 0.30, sz), new Vec3(0.25, 0.62, 0.25), `coral-spike-${index}-${s}`);
        const halo = this.mesh('torus', this.berryRingMaterial, new Vec3(sx, surface + 0.025, sz), new Vec3(0.22, 0.025, 0.22), `spike-warning-ring-${index}-${s}`);
        halo.setEulerAngles(90, 0, 0);
        extras.push(halo);
        spikes.push({ entity: spike, x: sx, y: surface + 0.30, z: sz });
      }
    }
    const berry = index > 0 ? this.mesh('sphere', this.berryMaterial, new Vec3(x + 0.18, surface + 0.78, z + 0.05), new Vec3(0.19, 0.19, 0.19), `jelly-berry-${index}`) : undefined;
    const berryRing = index > 0 ? this.mesh('torus', this.berryRingMaterial, new Vec3(x + 0.18, surface + 0.78, z + 0.05), new Vec3(0.29, 0.035, 0.29), `jelly-berry-ring-${index}`) : undefined;
    if (berryRing) berryRing.setEulerAngles(90, 0, 0);
    const platform: PlatformData = { index, x, y, z, surface, width, depth, hazard, entity, cap, ring, berry, berryRing, berryCollected: false, spikes, extras };
    this.platforms.set(index, platform);
    return platform;
  }

  private setPlayerToPlatform(index: number): void {
    const platform = this.platforms.get(index) ?? this.createPlatform(index);
    this.currentPlatformIndex = index;
    this.position.set(platform.x, platform.surface + BODY_LAND_HEIGHT, platform.z);
    this.oldY = this.position.y;
    this.velocity.set(0, 0, 0);
    this.player.enabled = true;
    this.player.setPosition(this.position);
    this.setSpringTarget([1, 1, 1]);
    this.setDotsVisible(false);
    this.updateCamera(0.016, true);
  }

  private ensureUpcomingPlatforms(): void {
    for (let i = this.currentPlatformIndex + 1; i <= this.currentPlatformIndex + 4; i += 1) {
      if (!this.platforms.has(i)) this.createPlatform(i);
    }
    for (const [index, platform] of this.platforms) {
      if (index < this.currentPlatformIndex - 2) {
        platform.entity.destroy();
        platform.cap.destroy();
        platform.ring.destroy();
        platform.extras.forEach((extra) => extra.destroy());
        platform.spikes.forEach((spike) => spike.entity.destroy());
        platform.berry?.destroy();
        platform.berryRing?.destroy();
        this.platforms.delete(index);
      }
    }
  }

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    this.canvas.addEventListener('pointerup', this.onPointerUp, { passive: false });
    this.canvas.addEventListener('pointercancel', this.onPointerCancel, { passive: false });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.active || this.hidden || this.state.tag !== 'IDLE' || event.button > 0) return;
    event.preventDefault();
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.pointerCurrent = { x: event.clientX, y: event.clientY };
    this.pullLength = 0;
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Capture is not supported by every host. */ }
    this.send({ type: 'AIM_START' });
    this.hooks.onPanic(false, 0);
    this.setSpringTarget([1.04, 0.94, 1.0]);
    this.updateAim(0);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerStart || this.state.tag !== 'AIMING' || this.hidden) return;
    event.preventDefault();
    this.pointerCurrent = { x: event.clientX, y: event.clientY };
    const dx = this.pointerCurrent.x - this.pointerStart.x;
    const dy = this.pointerCurrent.y - this.pointerStart.y;
    this.pullLength = Math.hypot(dx, dy);
    this.updateAim(this.pullLength);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerStart || this.state.tag !== 'AIMING' || this.hidden) return;
    event.preventDefault();
    if (this.pointerCurrent) {
      const dx = this.pointerCurrent.x - this.pointerStart.x;
      const dy = this.pointerCurrent.y - this.pointerStart.y;
      this.pullLength = Math.hypot(dx, dy);
    }
    this.launchFromPull(this.pullLength, this.pointerStart, this.pointerCurrent ?? this.pointerStart);
    this.pointerStart = null;
    this.pointerCurrent = null;
  };

  private readonly onPointerCancel = (): void => {
    if (this.state.tag === 'AIMING') this.cancelAim();
  };

  private cancelAim(): void {
    this.pointerStart = null;
    this.pointerCurrent = null;
    this.pullLength = 0;
    this.setDotsVisible(false);
    this.setSpringTarget([1, 1, 1]);
    this.hooks.onPanic(false, 0);
    this.send({ type: 'AIM_CANCEL' });
  }

  private updateAim(pull: number): void {
    const minDim = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const ratio = clamp(pull / (minDim * 0.48), 0, 1);
    this.send({ type: 'AIM_UPDATE', pull: ratio });
    this.setSpringTarget([1 + ratio * 0.34, 1 - ratio * 0.24, 1 + ratio * 0.1]);
    this.hooks.onPanic(ratio > 0.14, ratio);
    this.setDotsVisible(true);
    this.positionTrajectory(pull, this.pointerStart, this.pointerCurrent);
  }

  private launchFromPull(pull: number, start: { x: number; y: number }, current: { x: number; y: number }): void {
    const minDim = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const ratio = clamp(pull / (minDim * 0.48), 0, 1);
    const platform = this.platforms.get(this.currentPlatformIndex);
    const target = this.platforms.get(this.currentPlatformIndex + 1);
    if (!platform || !target) { this.cancelAim(); return; }
    let dirX: number;
    let dirZ: number;
    if (pull < 12) {
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const length = Math.hypot(dx, dz) || 1;
      dirX = dx / length;
      dirZ = dz / length;
    } else {
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const gestureX = -dx / length;
      const gestureZ = -dy / length;
      const targetX = target.x - platform.x;
      const targetZ = target.z - platform.z;
      const targetLength = Math.hypot(targetX, targetZ) || 1;
      const mixedX = gestureX * 0.79 + (targetX / targetLength) * 0.21;
      const mixedZ = gestureZ * 0.79 + (targetZ / targetLength) * 0.21;
      const mixedLength = Math.hypot(mixedX, mixedZ) || 1;
      dirX = mixedX / mixedLength;
      dirZ = mixedZ / mixedLength;
    }
    const power = pull < 12 ? 0.27 : clamp(pull / (minDim * 0.48), 0.08, 1);
    const horizontalSpeed = 4.65 + power * 2.55;
    this.velocity.set(dirX * horizontalSpeed, JUMP_VERTICAL, dirZ * horizontalSpeed);
    this.oldY = this.position.y;
    this.elapsed = 0;
    this.pointerStart = null;
    this.pointerCurrent = null;
    this.setDotsVisible(false);
    this.setSpringTarget([1.26, 0.65, 0.78]);
    this.send({ type: 'LAUNCH' });
    this.hooks.onPanic(true, Math.max(0.2, ratio * 0.65));
    this.hooks.onLaunch(power);
  }

  private positionTrajectory(pull: number, start: { x: number; y: number } | null, current: { x: number; y: number } | null): void {
    const from = start ?? { x: 0, y: 0 };
    const to = current ?? from;
    const minDim = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const target = this.platforms.get(this.currentPlatformIndex + 1);
    const currentPlatform = this.platforms.get(this.currentPlatformIndex);
    if (!target || !currentPlatform) return;
    let dirX = (target.x - this.position.x) / PLATFORM_GAP;
    let dirZ = (target.z - this.position.z) / PLATFORM_GAP;
    if (dist > 12) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      dirX = (-dx / length) * 0.79 + dirX * 0.21;
      dirZ = (-dy / length) * 0.79 + dirZ * 0.21;
      const lengthMixed = Math.hypot(dirX, dirZ) || 1;
      dirX /= lengthMixed;
      dirZ /= lengthMixed;
    } else {
      const length = Math.hypot(dirX, dirZ) || 1;
      dirX /= length;
      dirZ /= length;
    }
    const power = dist < 12 ? 0.27 : clamp(dist / (minDim * 0.48), 0.08, 1);
    const horizontalSpeed = 4.65 + power * 2.55;
    const vx = dirX * horizontalSpeed;
    const vz = dirZ * horizontalSpeed;
    const vy = JUMP_VERTICAL;
    for (let i = 0; i < this.dotEntities.length; i += 1) {
      const time = 0.09 + i * 0.075;
      const y = this.position.y + vy * time + 0.5 * GRAVITY * time * time;
      this.dotEntities[i].setPosition(this.position.x + vx * time, y, this.position.z + vz * time);
    }
  }

  private setDotsVisible(visible: boolean): void {
    for (const dot of this.dotEntities) dot.enabled = visible;
  }

  private update = (rawDt: number): void => {
    const dt = Math.min(0.034, Math.max(0, rawDt));
    if (this.hidden) return;
    this.wobbleClock += dt;
    this.updateSpring(dt);
    this.updateEnvironment(dt);
    this.updateParticles(dt);
    this.impactFlash = Math.max(0, this.impactFlash - dt * 2.8);
    if (this.active && this.state.tag === 'FLYING') this.updateFlight(dt);
    if (this.active && this.state.tag === 'IDLE') {
      const breathing = this.reduceMotion ? 0 : Math.sin(this.wobbleClock * 2.1) * 0.025;
      const scale = this.jellySpring.value;
      if (Math.abs(scale[1] - (1 + breathing)) < 0.12) this.jellySpring.target = [1, 1 + breathing, 1];
    }
    this.updateCamera(dt, false);
  };

  private updateFlight(dt: number): void {
    this.elapsed += dt;
    this.oldY = this.position.y;
    this.velocity.y += GRAVITY * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;
    this.player.setPosition(this.position);
    const flightRatio = clamp(this.elapsed / 0.36, 0, 1);
    if (this.elapsed < 0.2) this.setSpringTarget([1.20, 0.72, 0.82]);
    else if (this.elapsed < 0.46) this.setSpringTarget([0.83, 1.28, 0.82]);
    else this.setSpringTarget([0.92 + flightRatio * 0.08, 1.12 - flightRatio * 0.1, 0.94]);

    if (this.checkSpikeCollision()) {
      this.popJelly();
      return;
    }
    this.collectNearbyBerries();
    if (this.velocity.y <= 0 && this.tryLanding()) return;
    if (this.position.y < -5.9 || this.elapsed > 2.3) this.popJelly();
  }

  private checkSpikeCollision(): boolean {
    for (const platform of this.platforms.values()) {
      if (!platform.hazard) continue;
      for (const spike of platform.spikes) {
        const dx = this.position.x - spike.x;
        const dz = this.position.z - spike.z;
        const dy = this.position.y - spike.y;
        if (Math.abs(dx) < 0.42 && Math.abs(dz) < 0.43 && dy > -0.35 && dy < 0.76) {
          this.hooks.onToast('POP! THE CORAL SPIKES GOT YOU');
          return true;
        }
      }
    }
    return false;
  }

  private tryLanding(): boolean {
    for (const platform of this.platforms.values()) {
      if (platform.index < this.currentPlatformIndex) continue;
      const landingY = platform.surface + BODY_LAND_HEIGHT;
      if (this.oldY < landingY || this.position.y > landingY) continue;
      if (Math.abs(this.position.x - platform.x) > platform.width * 0.5 + 0.18) continue;
      if (Math.abs(this.position.z - platform.z) > platform.depth * 0.5 + 0.18) continue;
      if (platform.hazard && this.spikeWithinLanding(platform)) continue;
      this.land(platform);
      return true;
    }
    return false;
  }

  private spikeWithinLanding(platform: PlatformData): boolean {
    return platform.spikes.some((spike) => Math.abs(this.position.x - spike.x) < 0.48 && Math.abs(this.position.z - spike.z) < 0.49);
  }

  private land(platform: PlatformData): void {
    const previous = this.currentPlatformIndex;
    const progressed = platform.index > previous;
    this.position.set(platform.x, platform.surface + BODY_LAND_HEIGHT, platform.z);
    this.player.setPosition(this.position);
    this.velocity.set(0, 0, 0);
    this.currentPlatformIndex = platform.index;
    if (progressed) {
      this.levelsCleared += platform.index - previous;
      this.ensureUpcomingPlatforms();
      this.hooks.onToast(platform.hazard ? 'CLEAN LANDING! STAY CLEAR OF THE SPIKES' : 'JUICY LANDING! +1 LEVEL');
    } else {
      this.hooks.onToast('NICE SAVE — LINE UP THE NEXT BOUNCE');
    }
    this.setSpringTarget([1.28, 0.57, 1.08]);
    this.send({ type: 'LAND' });
    this.hooks.onImpact();
    this.hooks.onPanic(false, 0);
    this.emitStats();
    this.collectNearbyBerries();
    this.elapsed = 0;
  }

  private collectNearbyBerries(): void {
    for (const platform of this.platforms.values()) {
      if (!platform.berry || platform.berryCollected) continue;
      const dx = this.position.x - (platform.x + 0.18);
      const dy = this.position.y - (platform.surface + 0.78);
      const dz = this.position.z - (platform.z + 0.05);
      if (dx * dx + dy * dy + dz * dz < 0.72 * 0.72) {
        platform.berryCollected = true;
        platform.berry.destroy();
        platform.berry = undefined;
        platform.berryRing?.destroy();
        platform.berryRing = undefined;
        this.berries += 1;
        this.hooks.onBerry(this.berries);
        this.hooks.onToast('+1 JUICY BERRY');
        this.emitStats();
      }
    }
  }

  private popJelly(): void {
    if (this.state.tag !== 'FLYING') return;
    this.active = false;
    this.player.enabled = false;
    this.setDotsVisible(false);
    this.hooks.onPanic(true, 1);
    this.hooks.onImpact();
    this.spawnPopParticles();
    this.send({ type: 'POP', score: this.levelsCleared });
    this.best = Math.max(this.best, this.levelsCleared);
    this.emitStats();
    this.hooks.onGameOver(this.levelsCleared);
  }

  private spawnPopParticles(): void {
    this.destroyParticles();
    const palette = TINTS[this.tint];
    const paletteMat = makeMaterial(palette.outer, { emissive: palette.glow, opacity: 0.9, gloss: 94 });
    const droplets = 18;
    for (let i = 0; i < droplets; i += 1) {
      const angle = (Math.PI * 2 * i) / droplets + Math.random() * 0.22;
      const up = 1.1 + Math.random() * 4.1;
      const speed = 1.0 + Math.random() * 3.2;
      const entity = this.mesh('sphere', paletteMat, this.position.clone(), new Vec3(0.08 + Math.random() * 0.08, 0.08 + Math.random() * 0.08, 0.08 + Math.random() * 0.08), `jelly-droplet-${i}`);
      this.particles.push({ entity, vx: Math.cos(angle) * speed, vy: up, vz: Math.sin(angle) * speed, life: 0.9 + Math.random() * 0.35 });
    }
  }

  private destroyParticles(): void {
    this.particles.forEach((particle) => particle.entity.destroy());
    this.particles = [];
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= dt;
      particle.vy += GRAVITY * 0.55 * dt;
      const p = particle.entity.getPosition();
      particle.entity.setPosition(p.x + particle.vx * dt, p.y + particle.vy * dt, p.z + particle.vz * dt);
      if (particle.life <= 0) {
        particle.entity.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  private updateSpring(dt: number): void {
    const damping = 0.65;
    const response = 0.38;
    const omega = (2 * Math.PI) / response;
    for (let i = 0; i < 3; i += 1) {
      const acceleration = (this.jellySpring.target[i] - this.jellySpring.value[i]) * omega * omega - 2 * damping * omega * this.jellySpring.velocity[i];
      this.jellySpring.velocity[i] += acceleration * dt;
      this.jellySpring.value[i] += this.jellySpring.velocity[i] * dt;
    }
    this.player.setLocalScale(this.jellySpring.value[0], this.jellySpring.value[1], this.jellySpring.value[2]);
  }

  private setSpringTarget(target: [number, number, number]): void { this.jellySpring.target = target; }

  private updateEnvironment(dt: number): void {
    for (const star of this.starfield) {
      const y = star.baseY + (this.reduceMotion ? 0 : Math.sin(this.wobbleClock * star.speed + star.phase) * 0.11);
      const p = star.entity.getPosition();
      star.entity.setPosition(p.x, y, p.z);
    }
    for (const [index, platform] of this.platforms) {
      if (platform.berry && !platform.berryCollected) {
        const bob = this.reduceMotion ? 0 : Math.sin(this.wobbleClock * 2.2 + index) * 0.08;
        platform.berry.setPosition(platform.x + 0.18, platform.surface + 0.78 + bob, platform.z + 0.05);
        platform.berry.rotate(0, dt * 80, dt * 18);
        if (platform.berryRing) {
          platform.berryRing.setPosition(platform.x + 0.18, platform.surface + 0.78 + bob, platform.z + 0.05);
          platform.berryRing.rotate(0, dt * 54, 0);
        }
      }
      platform.ring.rotate(0, dt * 7, 0);
    }
  }

  private updateCamera(dt: number, snapNow: boolean): void {
    const lookX = this.position.x * 0.32;
    const lookY = this.position.y + 0.45;
    const lookZ = this.position.z - 3.15;
    const desired = new Vec3(this.position.x * 0.28, this.position.y + 5.45, this.position.z + 10.8);
    const blend = snapNow ? 1 : 1 - Math.exp(-Math.max(0.001, dt) * 2.8);
    const cp = this.camera.getPosition();
    this.cameraPosition.set(cp.x + (desired.x - cp.x) * blend, cp.y + (desired.y - cp.y) * blend, cp.z + (desired.z - cp.z) * blend);
    this.camera.setPosition(this.cameraPosition);
    this.camera.lookAt(new Vec3(lookX, lookY, lookZ));
  }

  private emitStats(): void {
    this.hooks.onStats({ level: this.currentPlatformIndex + 1, berries: this.berries, best: this.best, cleared: this.levelsCleared });
  }

  private mesh(type: string, material: StandardMaterial, position: Vec3, scale: Vec3, name: string, parent?: Entity): Entity {
    const entity = new Entity(name);
    entity.addComponent('render', { type: type as 'box' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'torus' });
    if (entity.render) entity.render.material = material;
    if (parent) {
      parent.addChild(entity);
      entity.setLocalPosition(position);
      entity.setLocalScale(scale);
    } else {
      this.app.root.addChild(entity);
      entity.setPosition(position);
      entity.setLocalScale(scale);
    }
    return entity;
  }
}

function makeMaterial(
  diffuse: [number, number, number],
  options: { emissive?: [number, number, number]; opacity?: number; gloss?: number; depthWrite?: boolean } = {}
): StandardMaterial {
  const material = new StandardMaterial();
  material.diffuse = color(diffuse);
  material.emissive = color(options.emissive ?? [0, 0, 0]);
  material.shininess = options.gloss ?? 70;
  material.opacity = options.opacity ?? 1;
  if ((options.opacity ?? 1) < 1) {
    material.blendType = BLEND_NORMAL;
    material.depthWrite = options.depthWrite ?? false;
  }
  material.update();
  return material;
}

function color(rgb: [number, number, number]): Color { return new Color(rgb[0], rgb[1], rgb[2]); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
