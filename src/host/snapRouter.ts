import snapchat from '@snap/web-lens-api';

export type JellyTint = 'aqua' | 'berry' | 'lilac' | 'sunshine';
export interface LensSave {
  berries: number;
  tint: JellyTint;
  bestScore: number;
}

type SnapError = Error & { message: string };
interface SnapClient {
  init(): Promise<void>;
  isSupported(capability: string, version?: number): boolean;
  isStub: boolean;
  errors: {
    QUOTA_EXCEEDED?: string;
    STORAGE_UNAVAILABLE?: string;
    INVALID_PARAMS?: string;
    INTERNAL?: string;
  };
  storage: {
    get(key: string): Promise<{ found: boolean; value?: unknown }>;
    set(key: string, value: unknown): Promise<void>;
  };
  leaderboards: {
    submitScore(args: { score: number }): Promise<unknown>;
    show(): Promise<void>;
  };
  bitmoji: {
    getAvatarInfo(): Promise<{ hasAvatar: boolean }>;
    get2DAvatar(args: { size: 'small' | 'medium' | 'large' }): Promise<{ url: string }>;
  };
}

const snap = snapchat as unknown as SnapClient;
const SAVE_KEY = 'jelly-jump-save-v1';
const DEFAULT_SAVE: LensSave = { berries: 0, tint: 'aqua', bestScore: 0 };

function normalizeSave(value: unknown): LensSave {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SAVE };
  const candidate = value as Partial<LensSave>;
  const tint = candidate.tint;
  return {
    berries: Number.isFinite(candidate.berries) ? Math.max(0, Math.floor(candidate.berries!)) : 0,
    bestScore: Number.isFinite(candidate.bestScore) ? Math.max(0, Math.floor(candidate.bestScore!)) : 0,
    tint: tint === 'berry' || tint === 'lilac' || tint === 'sunshine' ? tint : 'aqua'
  };
}

export class SnapRouter {
  private ready = false;
  private storageReady = false;
  private saveQueue: Promise<void> = Promise.resolve();
  private saveState: LensSave = { ...DEFAULT_SAVE };
  private readonly usingStub: boolean;
  hasStorage = false;
  hasLeaderboards = false;
  hasBitmoji = false;

  constructor() {
    this.usingStub = Boolean(snap.isStub);
  }

  get isStub(): boolean { return this.usingStub; }
  get isReady(): boolean { return this.ready; }
  get currentSave(): LensSave { return { ...this.saveState }; }

  async init(): Promise<LensSave> {
    try {
      await snap.init();
      this.ready = true;
      this.hasStorage = safeSupported('storage');
      this.hasLeaderboards = safeSupported('leaderboards');
      this.hasBitmoji = safeSupported('bitmoji');
      if (this.hasStorage) {
        // The initial read must finish before any writes are allowed.
        try {
          const stored = await snap.storage.get(SAVE_KEY);
          this.saveState = stored.found ? normalizeSave(stored.value) : { ...DEFAULT_SAVE };
          this.storageReady = true;
        } catch (error) {
          this.storageReady = false;
          this.hasStorage = false;
          console.warn('Jelly Jump: persistent storage is unavailable; using session-only progress.', safeError(error));
        }
      }
    } catch (error) {
      this.ready = false;
      this.hasStorage = false;
      this.hasLeaderboards = false;
      this.hasBitmoji = false;
      console.warn('Jelly Jump: Snapchat host bridge is unavailable; running in browser mode.', safeError(error));
    }
    return this.currentSave;
  }

  async getBitmojiUrl(): Promise<string | null> {
    if (!this.ready || !this.hasBitmoji || this.usingStub) return null;
    try {
      const info = await snap.bitmoji.getAvatarInfo();
      if (!info.hasAvatar) return null;
      const avatar = await snap.bitmoji.get2DAvatar({ size: 'small' });
      return typeof avatar.url === 'string' && avatar.url.length > 0 ? avatar.url : null;
    } catch (error) {
      console.warn('Jelly Jump: using the built-in reaction avatar.', safeError(error));
      return null;
    }
  }

  updateSave(patch: Partial<LensSave>): void {
    this.saveState = normalizeSave({ ...this.saveState, ...patch });
    if (!this.storageReady || !this.hasStorage) return;
    const snapshot = this.currentSave;
    // Serialize writes; never write every frame and keep the queue alive after a rejected write.
    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          await snap.storage.set(SAVE_KEY, snapshot);
        } catch (error) {
          const message = safeError(error).message;
          if (message === snap.errors.QUOTA_EXCEEDED || message === snap.errors.STORAGE_UNAVAILABLE) {
            console.warn('Jelly Jump: save was not persisted; current run remains playable.', message);
          } else {
            console.warn('Jelly Jump: save failed; current run remains playable.', message);
          }
        }
      });
  }

  async submitAndShowLeaderboard(score: number): Promise<boolean> {
    if (!this.ready || !this.hasLeaderboards) return false;
    try {
      // Snap binds this to the leaderboard configured for the current Lens.
      await snap.leaderboards.submitScore({ score: Math.max(0, Math.floor(score)) });
      await snap.leaderboards.show();
      return true;
    } catch (error) {
      console.warn('Jelly Jump: leaderboard unavailable; replay is still available.', safeError(error));
      return false;
    }
  }
}

function safeSupported(capability: string): boolean {
  try { return snap.isSupported(capability); } catch { return false; }
}

function safeError(error: unknown): SnapError {
  return error instanceof Error ? error as SnapError : new Error(String(error)) as SnapError;
}
