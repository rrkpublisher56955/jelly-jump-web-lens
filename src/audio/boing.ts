export class BoingAudio {
  private context: AudioContext | null = null;
  private muted = false;

  get isMuted(): boolean { return this.muted; }

  setMuted(muted: boolean): void { this.muted = muted; }

  async unlock(): Promise<void> {
    if (this.muted) return;
    try {
      const AudioContextCtor = window.AudioContext;
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
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const overtoneGain = ctx.createGain();
    const base = (impact ? 235 : 310) + Math.max(0, Math.min(1, power)) * 175;
    oscillator.type = 'sine';
    overtone.type = 'triangle';
    oscillator.frequency.setValueAtTime(base * (impact ? 1.45 : 1.75), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(75, base * 0.52), now + (impact ? 0.18 : 0.24));
    overtone.frequency.setValueAtTime(base * 2.1, now);
    overtone.frequency.exponentialRampToValueAtTime(base * 0.8, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(impact ? 0.11 : 0.075, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (impact ? 0.23 : 0.29));
    overtoneGain.gain.setValueAtTime(0.0001, now);
    overtoneGain.gain.exponentialRampToValueAtTime(impact ? 0.022 : 0.014, now + 0.015);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.connect(gain).connect(ctx.destination);
    overtone.connect(overtoneGain).connect(ctx.destination);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + 0.31);
    overtone.stop(now + 0.16);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    overtone.onended = () => { overtone.disconnect(); overtoneGain.disconnect(); };
  }
}
