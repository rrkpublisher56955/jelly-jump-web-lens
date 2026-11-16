import './styles.css';
import { BoingAudio } from './audio/boing';
import { JellyJumpGame } from './game/game';
import type { GameState } from './game/state';
import { SnapRouter, type JellyTint } from './host/snapRouter';
import { YouTubePlayablesRouter } from './host/ytPlayables';
import { TypeSafeSystemOneRouter, type PlayerTelemetryState } from './ai/typesafeRouter';

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required UI element #${id}`);
  return element as T;
};
const bySelector = <T extends Element>(selector: string): T[] => Array.from(document.querySelectorAll<T>(selector));

const canvas = $('game-canvas') as HTMLCanvasElement;
const loadingScreen = $('loading-screen');
const readyPanel = $('ready-panel');
const gameoverPanel = $('gameover-panel');
const pausePanel = $('pause-panel');
const howModal = $('how-modal');
const pauseButton = $('pause-button') as HTMLButtonElement;
const soundButton = $('sound-button') as HTMLButtonElement;
const aimHint = $('aim-hint');
const dragChip = $('drag-chip');
const avatarWidget = $('avatar-widget');
const avatarReaction = $('avatar-reaction');
const avatarMood = $('avatar-mood');
const avatarFallback = $('avatar-fallback');
const bitmojiImage = $('bitmoji-image') as HTMLImageElement;
const toast = $('toast');
const leaderboardButton = $('leaderboard-button') as HTMLButtonElement;

if (import.meta.env.DEV && new URLSearchParams(location.search).get('simulateSafeArea') === '1') {
  document.documentElement.style.setProperty('--inset-top', '124px');
  document.documentElement.dataset.safeAreaPreview = 'true';
}

const audio = new BoingAudio();
const snapRouter = new SnapRouter();
const ytRouter = new YouTubePlayablesRouter();
const typesafeAI = new TypeSafeSystemOneRouter();

let game: JellyJumpGame | null = null;
let started = false;
let toastTimer = 0;
let consecutiveLandings = 0;
let recentMisses = 0;
let spikeHits = 0;
let runStartTime = 0;

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1600);
}

function showTintSelection(tint: JellyTint): void {
  bySelector<HTMLButtonElement>('.tint-swatch').forEach((button) => {
    const selected = button.dataset.tint === tint;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function updateState(state: GameState): void {
  if (!started) return;
  const aiming = state.tag === 'AIMING';
  const flying = state.tag === 'FLYING';
  const paused = state.tag === 'PAUSED';
  const over = state.tag === 'GAMEOVER';

  dragChip.hidden = !aiming;
  aimHint.hidden = aiming || flying || paused || over;
  pausePanel.hidden = !paused;
  gameoverPanel.hidden = !over;
  pauseButton.hidden = over;

  if (over) {
    pauseButton.hidden = true;
    $('final-score').textContent = String(state.finalScore).padStart(2, '0');
    $('result-title').innerHTML = state.finalScore > 0 ? 'JUICY<br /><em>RUN!</em>' : 'A LITTLE<br /><em>SPLAT.</em>';
    $('result-eyebrow').innerHTML = state.finalScore > 0
      ? '<span class="eyebrow-dot"></span> NICE BOUNCING, LITTLE JELLY'
      : '<span class="eyebrow-dot"></span> NICE TRY, LITTLE JELLY';
    $('result-copy').textContent = state.finalScore > 0
      ? 'That was some premium-grade squish. Go even further.'
      : 'Every bounce makes a better run. Pull back and try again.';
    $('retry-button').querySelector('.button-icon')!.textContent = '↻';
    $('retry-button').querySelector('span:nth-child(2)')!.textContent = 'ONE MORE RUN';
    leaderboardButton.hidden = !snapRouter.hasLeaderboards;

    // Send score to YouTube Playables host if active
    ytRouter.submitScore(state.finalScore);
  }

  if (paused) {
    pauseButton.textContent = '▶';
    pauseButton.setAttribute('aria-label', 'Resume game');
  } else {
    pauseButton.textContent = 'Ⅱ';
    pauseButton.setAttribute('aria-label', 'Pause game');
  }
}

async function triggerAIEvaluation(): Promise<void> {
  if (!game) return;
  const telemetry: PlayerTelemetryState = {
    currentLevel: game.currentLevel,
    levelsCleared: game.score,
    berriesCollected: game.currentBerries,
    consecutiveLandings,
    recentMisses,
    averagePullDistance: 60,
    averageFlightTimeSec: 0.8,
    spikeHits,
    timeAliveSec: runStartTime > 0 ? (performance.now() - runStartTime) / 1000 : 0,
    lastActionDeltaMs: 400
  };

  const aiEval = await typesafeAI.evaluate(telemetry);

  // Apply TypeSafe System One judgments
  if (avatarMood && avatarReaction) {
    avatarMood.textContent = aiEval.avatarEmpathy.moodText;
    avatarReaction.textContent = aiEval.avatarEmpathy.reactionEmoji;
  }

  if (aiEval.isFrustrated.probability > 0.65) {
    showToast('AI ASSIST: GENTLE BOUNCE CADENCE');
  } else if (aiEval.isFlowState.probability > 0.75) {
    showToast(`FLOW STREAK! ×${consecutiveLandings}`);
  }
}

async function boot(): Promise<void> {
  // First frame signal for YouTube Playables / host environments
  ytRouter.notifyFirstFrame();

  // Setup YouTube Playables pause/resume hooks
  ytRouter.onPause(() => game?.pause());
  ytRouter.onResume(() => game?.resume());
  ytRouter.onAudioChange((enabled) => audio.setMuted(!enabled));

  // Initialize Snap router
  const saved = await snapRouter.init();

  // Check saved score from YouTube Playables if higher
  const ytScore = await ytRouter.getSavedScore();
  if (ytScore && ytScore > saved.bestScore) {
    saved.bestScore = ytScore;
  }

  game = new JellyJumpGame(canvas, {
    onState: updateState,
    onStats: (stats) => {
      $('level-value').textContent = String(stats.level).padStart(2, '0');
      $('berry-value').textContent = String(stats.berries).padStart(3, '0');
      $('best-value').textContent = String(Math.max(stats.best, saved.bestScore)).padStart(2, '0');
      if (stats.best > saved.bestScore) {
        snapRouter.updateSave({ bestScore: stats.best });
        ytRouter.submitScore(stats.best);
      }
    },
    onPanic: (panicking, pull) => {
      avatarWidget.classList.toggle('is-panicking', panicking);
      if (panicking) {
        avatarReaction.textContent = pull > 0.55 ? '😱' : '😳';
        avatarMood.textContent = pull > 0.55 ? 'TOO MUCH SQUISH!' : 'HOLD ON!!';
        $('avatar-name').textContent = 'PANIC MODE';
      } else {
        avatarReaction.textContent = '✦';
        avatarMood.textContent = 'Ready to wobble';
        $('avatar-name').textContent = 'SQUISH MODE';
      }
    },
    onToast: showToast,
    onImpact: () => {
      consecutiveLandings += 1;
      audio.playBoing(0.72, true);
      const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean }; vibrate?: (pattern: number | number[]) => boolean };
      if (nav.userActivation?.hasBeenActive && typeof nav.vibrate === 'function') {
        try { nav.vibrate(25); } catch { /* Optional haptic */ }
      }
      if (consecutiveLandings % 3 === 0) {
        void triggerAIEvaluation();
      }
    },
    onLaunch: (power) => {
      audio.playBoing(power, false);
      avatarReaction.textContent = '😵‍💫';
    },
    onGameOver: (score) => {
      recentMisses += 1;
      consecutiveLandings = 0;
      snapRouter.updateSave({ bestScore: Math.max(score, game?.bestScore ?? 0) });
      ytRouter.submitScore(Math.max(score, game?.bestScore ?? 0));
      pauseButton.hidden = true;
      showToast(score > 0 ? `RUN COMPLETE • ${score} LEVELS CLEARED` : 'THE JELLY HAS LEFT THE CHAT');
      void triggerAIEvaluation();
    },
    onTint: (tint) => {
      showTintSelection(tint);
      snapRouter.updateSave({ tint });
    },
    onBerry: (berries) => {
      audio.playBerry();
      snapRouter.updateSave({ berries });
    }
  }, saved);

  showTintSelection(saved.tint);

  if (ytRouter.isAvailable) {
    showToast('YOUTUBE PLAYABLES HOST CONNECTED');
  } else if (snapRouter.isStub) {
    showToast('BROWSER PREVIEW • APPLE DESIGN SUITE');
  }

  const avatarUrl = await snapRouter.getBitmojiUrl();
  if (avatarUrl) {
    bitmojiImage.onload = () => {
      bitmojiImage.hidden = false;
      avatarFallback.hidden = true;
    };
    bitmojiImage.onerror = () => {
      bitmojiImage.hidden = true;
      avatarFallback.hidden = false;
    };
    bitmojiImage.src = avatarUrl;
  }

  window.setTimeout(() => {
    loadingScreen.classList.add('is-done');
    ytRouter.notifyGameReady();
    (window as unknown as { __JELLY_LENS_READY__?: () => void }).__JELLY_LENS_READY__?.();
  }, 360);
}

function startGame(): void {
  if (!game) return;
  started = true;
  runStartTime = performance.now();
  consecutiveLandings = 0;
  recentMisses = 0;
  spikeHits = 0;

  readyPanel.hidden = true;
  gameoverPanel.hidden = true;
  pausePanel.hidden = true;
  pauseButton.hidden = false;
  aimHint.hidden = false;

  void audio.unlock();
  game.startRun();
  updateState(game.currentState);
}

// Button Events
$('play-button').addEventListener('click', startGame);
$('retry-button').addEventListener('click', () => {
  if (!game) return;
  void audio.unlock();
  consecutiveLandings = 0;
  runStartTime = performance.now();
  game.replay();
  updateState(game.currentState);
});
$('resume-button').addEventListener('click', () => game?.resume());
pauseButton.addEventListener('click', () => {
  if (!game) return;
  if (game.currentState.tag === 'PAUSED') game.resume();
  else game.pause();
});

function openHow(): void { howModal.hidden = false; }
function closeHow(): void { howModal.hidden = true; }
$('how-button').addEventListener('click', openHow);
$('pause-how-button').addEventListener('click', openHow);
$('close-how-button').addEventListener('click', closeHow);
$('got-it-button').addEventListener('click', () => {
  closeHow();
  if (!started) startGame();
});
howModal.addEventListener('pointerdown', (event) => {
  if (event.target === howModal) closeHow();
});

soundButton.addEventListener('click', () => {
  const muted = !audio.isMuted;
  audio.setMuted(muted);
  soundButton.textContent = muted ? '×' : '♪';
  soundButton.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  if (!muted) void audio.unlock();
  showToast(muted ? 'SOUND OFF' : 'SOUND ON');
});

bySelector<HTMLButtonElement>('.tint-swatch').forEach((button) => {
  button.addEventListener('click', () => {
    const tint = button.dataset.tint as JellyTint | undefined;
    if (!tint || !game) return;
    game.setTint(tint);
  });
});

leaderboardButton.addEventListener('click', async () => {
  if (!game) return;
  const ok = await snapRouter.submitAndShowLeaderboard(game.score);
  if (!ok) showToast('LEADERBOARD IS NOT AVAILABLE HERE');
});

// YouTube Playables & Desktop Keyboard Controls
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!started) {
      startGame();
    } else if (game?.currentState.tag === 'GAMEOVER') {
      game.replay();
      updateState(game.currentState);
    }
  } else if (event.code === 'KeyP') {
    if (game?.currentState.tag === 'PAUSED') game.resume();
    else game?.pause();
  } else if (event.code === 'KeyM') {
    soundButton.click();
  }
});

canvas.addEventListener('pointerdown', () => { void audio.unlock(); }, { passive: true });
window.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  game?.setVisibilityPaused(hidden);
  if (hidden) audio.suspend();
  else audio.resume();
});

window.addEventListener('pagehide', () => {
  if (game) {
    snapRouter.updateSave({ berries: game.currentBerries, tint: game.currentTint, bestScore: game.bestScore });
    ytRouter.submitScore(game.bestScore);
  }
});

void boot().catch((error: unknown) => {
  console.error('Jelly Jump failed to boot:', error);
  loadingScreen.classList.add('is-done');
  showToast('A LITTLE BOOT HICCUP — REFRESH TO TRY AGAIN');
});
