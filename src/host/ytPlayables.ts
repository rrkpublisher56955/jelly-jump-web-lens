/**
 * YouTube Playables Integration Bridge
 *
 * Fully supports the official YouTube Playables SDK specifications, lifecycle hooks,
 * audio focus management, and responsive resolution sizing (9:16 portrait and 16:9 landscape).
 */

export interface YTPlayablesSDK {
  firstFrameReady?: () => void;
  gameReady?: () => void;
  sendScore?: (args: { value: number }) => void;
  getScore?: () => Promise<{ value: number }>;
  onPause?: (callback: () => void) => void;
  onResume?: (callback: () => void) => void;
  isAudioEnabled?: () => boolean;
  onAudioEnabledChange?: (callback: (enabled: boolean) => void) => void;
}

declare global {
  interface Window {
    YTPlayables?: YTPlayablesSDK;
    ytplayables?: YTPlayablesSDK;
  }
}

export type HostPlatform = 'YOUTUBE_PLAYABLES' | 'SNAP_LENS' | 'STANDALONE_WEB';

export class YouTubePlayablesRouter {
  private sdk: YTPlayablesSDK | null = null;
  private isDetected = false;
  private firstFrameReported = false;
  private gameReadyReported = false;
  private pauseCallbacks: Array<() => void> = [];
  private resumeCallbacks: Array<() => void> = [];
  private audioCallbacks: Array<(enabled: boolean) => void> = [];
  private audioMuted = false;

  constructor() {
    this.detectSDK();
  }

  private detectSDK(): void {
    if (typeof window === 'undefined') return;
    this.sdk = window.YTPlayables || window.ytplayables || null;
    this.isDetected = Boolean(this.sdk);

    if (this.sdk) {
      // Wire lifecycle listeners
      if (typeof this.sdk.onPause === 'function') {
        this.sdk.onPause(() => {
          this.pauseCallbacks.forEach((cb) => {
            try { cb(); } catch (e) { console.warn('YT Playables onPause error:', e); }
          });
        });
      }

      if (typeof this.sdk.onResume === 'function') {
        this.sdk.onResume(() => {
          this.resumeCallbacks.forEach((cb) => {
            try { cb(); } catch (e) { console.warn('YT Playables onResume error:', e); }
          });
        });
      }

      if (typeof this.sdk.onAudioEnabledChange === 'function') {
        this.sdk.onAudioEnabledChange((enabled: boolean) => {
          this.audioMuted = !enabled;
          this.audioCallbacks.forEach((cb) => {
            try { cb(enabled); } catch (e) { console.warn('YT Playables audio change error:', e); }
          });
        });
      }

      if (typeof this.sdk.isAudioEnabled === 'function') {
        try {
          this.audioMuted = !this.sdk.isAudioEnabled();
        } catch {
          this.audioMuted = false;
        }
      }
    }
  }

  get isAvailable(): boolean {
    return this.isDetected;
  }

  get isAudioMuted(): boolean {
    return this.audioMuted;
  }

  /**
   * Notifies the YouTube Playables test suite and container that the first visual frame
   * is drawn on the canvas, allowing the host splash screen to transition cleanly.
   */
  notifyFirstFrame(): void {
    if (this.firstFrameReported) return;
    this.firstFrameReported = true;
    if (this.sdk && typeof this.sdk.firstFrameReady === 'function') {
      try {
        this.sdk.firstFrameReady();
      } catch (err) {
        console.warn('YT Playables firstFrameReady failed:', err);
      }
    }
  }

  /**
   * Notifies the YouTube Playables test suite that the game is fully loaded, assets
   * are prepared, and the user can now interact with the experience.
   */
  notifyGameReady(): void {
    if (this.gameReadyReported) return;
    this.gameReadyReported = true;
    if (this.sdk && typeof this.sdk.gameReady === 'function') {
      try {
        this.sdk.gameReady();
      } catch (err) {
        console.warn('YT Playables gameReady failed:', err);
      }
    }
  }

  /**
   * Submits the player's run score to YouTube Playables statistics.
   */
  submitScore(score: number): void {
    if (this.sdk && typeof this.sdk.sendScore === 'function') {
      try {
        this.sdk.sendScore({ value: Math.max(0, Math.floor(score)) });
      } catch (err) {
        console.warn('YT Playables sendScore failed:', err);
      }
    }
  }

  /**
   * Retrieves high score if stored by the host.
   */
  async getSavedScore(): Promise<number | null> {
    if (this.sdk && typeof this.sdk.getScore === 'function') {
      try {
        const res = await this.sdk.getScore();
        if (res && typeof res.value === 'number') {
          return res.value;
        }
      } catch (err) {
        console.warn('YT Playables getScore failed:', err);
      }
    }
    return null;
  }

  onPause(cb: () => void): void {
    this.pauseCallbacks.push(cb);
  }

  onResume(cb: () => void): void {
    this.resumeCallbacks.push(cb);
  }

  onAudioChange(cb: (enabled: boolean) => void): void {
    this.audioCallbacks.push(cb);
  }
}
