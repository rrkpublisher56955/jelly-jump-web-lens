export class BoingAudio {
  private context: AudioContext | null = null;
  private muted = false;

  get isMuted(): boolean { return this.muted; }

  setMuted(muted: boolean): void { this.muted = muted; }

  async unlock(): Promise<void> {
    if (this.muted) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!this.context) this.context = new AudioContextCtor({ latencyHint: 'interactive' });
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      // Audio is an enhancement; the game remains fully playable without it.
    }
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }

  resume(): void {
    if (!this.muted && this.context?.state === 'suspended') void this.context.resume().catch(() => undefined);
  }

  playBoing(power = 0.5, impact = false): void {
    if (this.muted) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!this.context) this.context = new AudioContextCtor({ latencyHint: 'interactive' });
      if (this.context.state === 'suspended') void this.context.resume();
      const ctx = this.context;
      const t = ctx.currentTime;
      const clampedPower = Math.max(0, Math.min(1, power));
      const base = (impact ? 175 : 290) + clampedPower * 140;

      // Primary tone carrier
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = impact ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(base * (impact ? 1.5 : 1.9), t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(48, base * 0.38), t + (impact ? 0.28 : 0.22));

      // Organic FM squelch modulation
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(impact ? 85 : 130, t);
      mod.frequency.exponentialRampToValueAtTime(25, t + 0.18);
      modGain.gain.setValueAtTime(base * (impact ? 0.9 : 0.6), t);
      modGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      mod.connect(osc.frequency);
      mod.start(t);
      mod.stop(t + 0.2);

      // Low pass acoustic warm filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(impact ? 1800 : 3200, t);
      filter.frequency.exponentialRampToValueAtTime(320, t + 0.25);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(impact ? 0.16 : 0.09, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (impact ? 0.32 : 0.26));

      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);

      // Sub-bass physical gelatin impact thud
      if (impact) {
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(75, t);
        sub.frequency.exponentialRampToValueAtTime(32, t + 0.15);
        subGain.gain.setValueAtTime(0.18, t);
        subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        sub.connect(subGain).connect(ctx.destination);
        sub.start(t);
        sub.stop(t + 0.2);
      }
    } catch {
      // Audio is an enhancement
    }
  }

  playBerry(): void {
    if (this.muted) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!this.context) this.context = new AudioContextCtor({ latencyHint: 'interactive' });
      if (this.context.state === 'suspended') void this.context.resume();
      const ctx = this.context;
      const t = ctx.currentTime;
      [880, 1318.5, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.05);
        gain.gain.setValueAtTime(0.0001, t + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.08, t + i * 0.05 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t + i * 0.05);
        osc.stop(t + i * 0.05 + 0.32);
      });
    } catch {
      // Audio is an enhancement
    }
  }
}
