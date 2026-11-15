<div align="center">

# 🫧 Jelly Jump — Soft-Body Sprint

**An Apple-inspired, photography-first 3D physics platformer built for YouTube Playables, Snapchat Web Lens, and Standalone High-DPI Web.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PlayCanvas](https://img.shields.io/badge/PlayCanvas-2.7-E05F2B?style=flat-square&logo=playcanvas&logoColor=white)](https://playcanvas.com/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Apple HIG Design](https://img.shields.io/badge/Design-Apple%20HIG%20Fluid-0066CC?style=flat-square&logo=apple&logoColor=white)](https://developer.apple.com/design/)
[![YouTube Playables](https://img.shields.io/badge/YouTube-Playables%20Ready-FF0000?style=flat-square&logo=youtube&logoColor=white)](https://www.youtube.com/)
[![Snapchat Lens](https://img.shields.io/badge/Snapchat-Web%20Lens%20API-FFFC00?style=flat-square&logo=snapchat&logoColor=black)](https://developers.snap.com/)
[![TypeSafe AI](https://img.shields.io/badge/TypeSafe%20AI-System%20One%20Jev-7928CA?style=flat-square)](https://typesafe.ai/)

<br />

<p align="center">
  <b>Stretch. Fling. Bounce.</b><br />
  A masterclass in reverent, translucent soft-body physics framed by Apple's minimalist museum-gallery aesthetics, intelligent TypeSafe System One adaptive AI, and cross-platform multi-host architecture.
</p>

[🎮 Offline Instant Preview](file:///browser-preview.html) • [📐 Architecture](#-system-architecture) • [🍎 Apple Design System](#-apple-design-system--fluid-motion) • [🧠 TypeSafe AI Routing](#-typesafe-system-one-ai-routing) • [📺 YouTube Playables](#-youtube-playables-compliance--resolution) • [🚀 Quickstart](#-quickstart--local-development)

---

</div>

## 🌟 Executive Overview

**Jelly Jump — Soft-Body Sprint** transforms mobile and web platforming into an ultra-responsive, tactile experience. The player pulls back against a simulated three-axis spring, views a dotted parabolic flight trajectory, and releases to launch a squishy, iridescent jelly creature across floating quartz and obsidian platforms.

### Key Pillars
- **Apple Design System & Fluid Motion:** Engineered to strict Apple Human Interface Guidelines (HIG). Employs SF Pro typography with signature negative display tracking, translucent frosted glass chrome (`backdrop-filter: blur(20px) saturate(180%)`), Action Blue (`#0066cc`) interactive grammar, zero decorative clutter, and critically damped spring dynamics.
- **TypeSafe System One AI Integration:** Employs TypeSafe's fast **Jev** System One model architecture using typed primitives (`Choice`, `Noul`, `Score`) to perform real-time telemetry analysis, evaluate player frustration vs. flow states, and execute dynamic difficulty routing (DDA).
- **YouTube Playables Full Compliance:** Native lifecycle management (`firstFrameReady`, `gameReady`, `sendScore`, `onPause`, `onResume`), responsive dual-aspect viewport support (Portrait 9:16 and Landscape 16:9), and desktop keyboard navigation.
- **Snapchat Web Lens Certified:** Full integration with `@snap/web-lens-api`, supporting Bitmoji 2D reactions, localized storage, and lens leaderboards, packaged within an ultra-compact `< 1 MiB` ZIP footprint.
- **Retina & 8K Crisp Graphics:** High-DPI canvas rasterization at native device pixel ratios (up to `2.5×`), physically-based materials with fresnel rim lighting, gloss highlights, subsurface scattering glow, and ground-bounce particle physics.
- **Realistic 3D Volumetric Engine:** Deep PBR chamfered monoliths with quantum laser conduits, 5-layer optical translucent gelatin with secondary spring inertia, 3D faceted ruby-obsidian crystal spikes, rotating prismatic star gems with gyroscope rings, and an 8K cosmic nebula environment with a distant ringed gas giant.
- **Organic Physical Audio Synthesis:** Real-time Web Audio FM squelch modulation, warm acoustic low-pass filtering, physical sub-bass gelatin impact thud (75 Hz → 32 Hz), and pentatonic celestial star chimes.

---

## 📐 System Architecture

The following diagram illustrates how user input, the physics core, TypeSafe System One AI, and multi-host environments interact seamlessly:

```mermaid
flowchart TD
    subgraph InputLayer ["🎮 Input & Control Layer"]
        PE["Pointer Events\n(Direct 1:1 Tracking & Capture)"]
        KB["Keyboard Navigation\n(Space / P / M / Arrows)"]
        TC["Touch Gestures\n(Hysteresis & Rubber-Banding)"]
    end

    subgraph CoreEngine ["⚡ Jelly Jump Physics & Rendering Engine"]
        PC["PlayCanvas 3D / Retina Canvas 2D\n(High-DPI 2.5x Rasterizer)"]
        Spring["Three-Axis Damped Spring\n(Damping: 0.8 Momentum / 1.0 Critically Damped)"]
        Proc["Procedural Platform Generator\n(Floating Quartz / Hazard Spikes / Berries)"]
        Audio["Web Audio Synthesizer\n(Boing Oscillators & Spatial Pops)"]
    end

    subgraph TypeSafeAI ["🧠 TypeSafe System One AI Engine (Jev)"]
        Telemetry["Player Telemetry Stream\n(Misses, Streaks, Flight Time, Spike Hits)"]
        NoulFrust["Noul: isFrustrated\n(Tilt & Recovery Probability)"]
        NoulFlow["Noul: isFlowState\n(Rhythm & Landing Momentum)"]
        ScoreAim["Score: aimMastery\n(Graded 1-5 Arc Precision)"]
        ChoiceRoute["Choice: difficultyRoute\n(Gentle Recovery / Balanced / Precision / Aerial)"]
        ChoiceEmpathy["Choice: avatarEmpathy\n(Dynamic Mood & Reaction Tone)"]
    end

    subgraph HostBridge ["🌐 Multi-Host Abstraction Layer"]
        YT["YouTube Playables Bridge\n(firstFrameReady, gameReady, sendScore, 9:16 & 16:9)"]
        Snap["Snapchat Web Lens API\n(Bitmoji Avatar, Storage, Leaderboards)"]
        Web["Standalone Web Preview\n(Zero-Dependency Offline Playable)"]
    end

    InputLayer --> CoreEngine
    CoreEngine --> Telemetry
    Telemetry --> NoulFrust & NoulFlow & ScoreAim
    NoulFrust & NoulFlow & ScoreAim --> ChoiceRoute & ChoiceEmpathy
    ChoiceRoute --> Proc
    ChoiceEmpathy --> CoreEngine
    CoreEngine --> HostBridge
```

---

## 🍎 Apple Design System & Fluid Motion

Built strictly upon Apple's WWDC design foundations (*Designing Fluid Interfaces* & *Principles of Great Design*), UI chrome recedes so the tactile product can speak:

### 1. The Color Palette & Material Chassis
- **Action Blue (`#0066cc`):** Universal brand interactive color across light tiles, primary pill buttons, and text links.
- **Focus Blue (`#0071e3`):** Accessible `2px solid` keyboard focus rings.
- **Sky Link Blue (`#2997ff`):** High-contrast interactive accent reserved for dark tiles.
- **Near-Black Ink (`#1d1d1f`):** Photographic typographic text fill.
- **Parchment (`#f5f5f7`) & Pure White (`#ffffff`):** Alternating light canvas rhythm.
- **Near-Black Surfaces (`#272729`, `#2a2a2c`, `#252527`):** Dark tile section breaks.
- **Translucent Frosted Glass:** `background: rgba(26, 28, 44, 0.76); backdrop-filter: blur(20px) saturate(180%);` with crisp 1px light-catching specular borders.

### 2. Apple Typographic Ladder (SF Pro Display & SF Pro Text)
| Token | Font Family | Size | Weight | Line Height | Tracking | Usage |
|:---|:---|:---|:---|:---|:---|:---|
| `hero-display` | SF Pro Display | 56px | 600 | 1.07 | `-0.28px` | Hero title headlines |
| `display-lg` | SF Pro Display | 40px | 600 | 1.10 | `0px` | Modal & tile section titles |
| `display-md` | SF Pro Text | 34px | 600 | 1.47 | `-0.374px` | Large section headings |
| `tagline` | SF Pro Display | 21px | 600 | 1.19 | `+0.231px` | Sub-nav brand lockup |
| `body` | SF Pro Text | 17px | 400 | 1.47 | `-0.374px` | Standard body copy (Apple 17px standard) |
| `button-primary` | SF Pro Text | 17px | 400 | 1.00 | `-0.374px` | Full-pill CTAs (`border-radius: 9999px`) |
| `caption` | SF Pro Text | 14px | 400 | 1.43 | `-0.224px` | Secondary descriptors & instructions |
| `nav-link` | SF Pro Text | 12px | 400 | 1.00 | `-0.12px` | Pinned 44px global bar items |

> [!NOTE]
> In accordance with Apple HIG, weight 500 is deliberately absent (ladder strictly adheres to 300 / 400 / 600 / 700). Display sizes feature signature negative tracking for the iconic "Apple tight" cadence.

### 3. Fluid Physics & Micro-Interactions
- **Immediate Feedback:** All tappable controls react on `pointerdown` via `transform: scale(0.97)` without debouncing or delay.
- **Direct Manipulation:** Input tracking glues 1:1 with pointer coordinates using `setPointerCapture` and grab-offset awareness.
- **Interruptible Springs:** Jelly motion decomposes into independent three-axis harmonic oscillators ($x, y, z$) with critical damping ($\zeta = 1.0$) during rest and snappy momentum response ($\zeta = 0.8$, $T_0 = 0.35\text{s}$) upon fling release.
- **Boundary Rubber-Banding:** Pull limits soften progressively past boundary constraints using exponential deceleration.

---

## 🧠 TypeSafe System One AI Routing

Unlike conventional games that rely on rigid, hard-coded modulo formulas, Jelly Jump integrates an AI evaluation and routing pattern based on **TypeSafe's System One model architecture (Jev)**. 

### Why System One?
System One models provide fast, calibrated judgments directly into code rather than slow, unstructured chat generation. Code retains complete control over calculations and state execution, while the AI supplies programmable common sense.

```
┌────────────────────────────────────────────────────────┐
│           Player Telemetry State (JSON)                │
│ (missRate, streak, pullDistance, flightDuration, spikes)│
└──────────────────────────┬─────────────────────────────┘
                           │
             Parallel Speculative Fan-Out
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│     Noul     │    │    Score     │    │    Choice    │
│ isFrustrated │    │  aimMastery  │    │difficultyRout│
│   (0.0-1.0)  │    │  (Level 1-5) │    │  (4 Options) │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
          Dynamic Difficulty Adjustment (DDA)
    (Platform Gap ×0.88-1.15, Magnetic Nudge, Berry Drops)
```

### TypeSafe Primitives Utilized
1. **`Noul` (Condition Hold Probabilities):**
   - `isFrustrated`: Evaluates consecutive misses, tilt, and erratic retries. When $> 0.60$, triggers gentle recovery pacing and reassuring avatar empathy.
   - `isFlowState`: Computes momentum when a player achieves rhythm landing streaks. When $> 0.75$, triggers combo multipliers and celebratory particle cascades.
2. **`Score` (Graded Ordinal Measurement):**
   - `aimMastery` (1 to 5): Classifies player trajectory control from *Erratic launch calibration* (1) up to *Surgical arc virtuoso* (5).
3. **`Choice` (Discrete Routing Selection):**
   - `difficultyRoute`: Routes the procedural generator to `GENTLE_RECOVERY`, `BALANCED_CADENCE`, `PRECISION_CHALLENGE`, or `AERIAL_CASCADE`.
   - `avatarEmpathy`: Dynamically adapts avatar expression and mood caption (`COMFORTING_WOBBLE`, `PLAYFUL_CHEER`, `FOCUS_HYPE`, or `TRIUMPHANT_GLOW`).

---

## 📺 YouTube Playables Compliance & Resolution

Jelly Jump is built and tested to meet all official **YouTube Playables Certification** requirements:

### Lifecycle Hooks Matrix
- **`firstFrameReady()`:** Dispatched immediately upon canvas context acquisition and first clear, allowing YouTube's loading scrim to transition seamlessly.
- **`gameReady()`:** Emitted once 3D scenes, audio buffers, and save states are mounted, signaling interactive readiness.
- **`onPause()` & `onResume()`:** Intercepts YouTube container lifecycle pauses, automatically suspending WebGL animation loops and audio contexts to preserve device battery.
- **`onAudioEnabledChange()`:** Respects YouTube's global mute toggle.
- **`sendScore({ value })`:** Synchronizes player scores to YouTube Playables user profiles.

### Responsive Aspect Ratio & Safe Areas
- **Portrait (9:16):** Native mobile play at `720×1280` or `1080×1920` with full safe-area inset preservation (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`).
- **Landscape (16:9):** Wide desktop/tablet play at `1280×720` or `1920×1080` with auto-centering HUD cards and extended camera perspective.
- **Desktop Keyboard Controls:**
  - `Space`: Pull / Launch jelly, start game, or instant replay.
  - `P`: Pause / Resume simulation.
  - `M`: Toggle audio mute state.

---

## 💡 Suggested Future Enhancements (Non-Monetized)

To keep the game pure, delightful, and 100% free of invasive monetization or ads, the following gameplay expansions are designed:

1. **🌿 Zen Free-Bounce Mode:**
   An endless, hazard-free cosmic mode with zero spikes and endless floating clouds. Includes procedurally generated ambient wind chimes synchronized to each bounce for relaxation and focus.
2. **👻 Ghost Hologram Replays:**
   Record your personal best flight arcs and render them as a translucent, shimmering neon ghost alongside your live run, allowing you to race your previous best.
3. **🎨 Chromatic Jelly Lab:**
   Unlock custom procedural shaders and jelly finishes through skill milestones:
   - *Opal Pearl* (clearing 15 platforms in one run).
   - *Liquid Gold* (collecting 100 golden berries).
   - *Aurora Borealis* (achieving a 10-streak flow state).
4. **⏱️ Chrono Time-Attack (60s Blitz):**
   A high-energy countdown challenge where platforms collapse after 2 seconds, rewarding rapid rhythmic flings.
5. **🥽 WebXR Tabletop AR Camera Mode:**
   Utilizing WebXR to place the floating platforms right on the player's physical desk or coffee table via device camera passthrough.

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Node.js 20+ (tested and verified on Node.js v26)
- npm 10+
- Modern WebGL 2 capable browser

### Installation
```powershell
# Clone the repository
git clone https://github.com/rrkpublisher56955/jelly-jump-web-lens.git
cd jelly-jump-web-lens

# Install dependencies
npm install
```

### Development Server
```powershell
npm run dev
```
Open `http://localhost:5173` in your browser. To simulate safe-area notches during development, append `?simulateSafeArea=1`.

### Production Build & Packaging
```powershell
# Strict TypeScript checking
npm run typecheck

# Production Vite compilation into dist/
npm run build

# Package into production my-web-lens.zip (< 1 MiB)
npm run pack

# Run automated static verification suite
npm run verify

# Preview the built production site
npm run preview
```

### ⚡ Offline Standalone Preview (Zero Dependencies)
You can directly open `browser-preview.html` in any browser or run:
```powershell
Start-Process "browser-preview.html"
```
Contains a self-contained, high-DPI Canvas 2D engine replicating the exact spring dynamics, Apple HUD, and YouTube Playables hooks without needing an active node server.

---

## 📂 Repository File Structure

```text
jelly-jump-web-lens/
├── .github/
│   └── workflows/
│       └── build.yml               # Automated CI verification workflow
├── dist/                           # Compiled production Web Lens output
├── src/
│   ├── ai/
│   │   └── typesafeRouter.ts       # TypeSafe System One AI (Jev) evaluator & DDA
│   ├── audio/
│   │   └── boing.ts                # Damped Web Audio frequency synthesis
│   ├── game/
│   │   ├── game.ts                 # PlayCanvas 3D engine, jelly physics & scene
│   │   └── state.ts                # Deterministic FSM game state machine
│   ├── host/
│   │   ├── snapRouter.ts           # Snapchat Web Lens SDK bridge & storage
│   │   └── ytPlayables.ts          # YouTube Playables lifecycle & resolution adapter
│   ├── main.ts                     # Application entry point & HUD event orchestration
│   ├── styles.css                  # Apple Design System & HIG fluid motion styles
│   └── vite-env.d.ts               # Vite environment type declarations
├── tools/
│   ├── pack.mjs                    # POSIX ZIP packaging utility (POSIX compliant)
│   └── verify.mjs                  # Size ceilings & relative asset integrity tester
├── browser-preview.html            # Standalone zero-dependency browser preview
├── browser-preview.js              # Standalone high-DPI Canvas 2D engine
├── browser-preview-dist/           # Offline portable package distribution
├── my-web-lens.zip                 # Built production ZIP artifact for Snap upload
├── package.json                    # Project dependencies & npm scripts
├── tsconfig.json                   # Strict TypeScript compiler options
└── vite.config.ts                  # Vite build configuration with relative base
```

---

## 📜 Verification & Test Matrix

All builds undergo strict automated gate checks:

| Test / Gate | Target Specification | Status |
|:---|:---|:---:|
| **TypeScript Typecheck** | `tsc --noEmit` (Strict mode) | ✅ **PASS** |
| **Vite Bundle Build** | ES Module rollup with relative asset paths | ✅ **PASS** |
| **Index Size Ceiling** | `dist/index.html` $\le$ 1024 KiB (Actual: 7.6 KiB) | ✅ **PASS** |
| **ZIP Package Ceiling** | `my-web-lens.zip` $\le$ 8 MiB (Actual: 0.551 MiB) | ✅ **PASS** |
| **ZIP Root Alignment** | `index.html` at archive root with POSIX slashes | ✅ **PASS** |
| **Remote Asset Guard** | Zero unapproved external CDN / font dependencies | ✅ **PASS** |
| **YouTube Playables** | Lifecycle events & dual 9:16 / 16:9 viewport support | ✅ **PASS** |
| **TypeSafe System One** | Jev schema validation, Noul/Score/Choice routing | ✅ **PASS** |

---

<div align="center">
  <sub>Crafted with precision for <b>rrkpublisher56955</b>. Built with PlayCanvas, Apple HIG, and TypeSafe AI.</sub>
</div>
