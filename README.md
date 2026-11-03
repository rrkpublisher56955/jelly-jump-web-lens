# Jelly Jump — Soft-Body Sprint

A portrait-first 3D fling platformer based on Catalog No. 017 **Jelly Jump**. The player pulls back to aim, sees a dotted predicted arc, then releases to launch a glossy jelly creature toward floating platforms. The body uses a damped three-axis spring for squash/stretch; landings play synthesized Web Audio, trigger optional haptics, and reward berry collection. Coral spikes pop the jelly into harmless droplets. A playable run, game-over, retry, pause, instructions, tint customization, and reaction avatar are included.

The source app uses PlayCanvas, Vite, TypeScript, and the official `@snap/web-lens-api` package. Gameplay works without optional Snap capabilities. The Web Lens itself is a static ZIP, not a server-backed app.

## Requirements

- Node.js 20+ recommended
- npm
- A browser with WebGL 2 for local testing

## Windows / PowerShell setup

From the project folder:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The browser uses Snap's desktop stub where available; browser stub behavior is not proof of live Snapchat behavior.

## Checks and packaging

```powershell
npm run typecheck
npm run build
npm run pack
npm run verify
npm run preview
```

- `typecheck` runs strict TypeScript checking.
- `build` creates the static site in `dist/` with `base: './'` and no source maps.
- `pack` produces `my-web-lens.zip`, putting the **contents** of `dist/` at the ZIP root. It rejects `index.html` above 1 MiB or a ZIP above 8 MiB.
- `verify` checks the built entry point, relative HTML asset paths, file existence, archive root, ZIP path separators, and the current size ceilings.
- `preview` serves the production build locally.

A GitHub Actions workflow at `.github/workflows/build.yml` runs type-check, build, package, and verification on pushes, pull requests, and manual dispatches. It must be committed to a repository with Actions enabled; the current workspace has not been pushed to GitHub.

To test safe-area layout in development, open the Vite URL with `?simulateSafeArea=1`. The fake top inset is development-only and is not hard-coded into production.

## Controls

1. Press **LET'S JUMP**.
2. Touch or click the game scene, drag in the opposite direction to the desired flight, then release. The dotted markers show the predicted arc.
3. Land on the next luminous platform, collect golden berries, and avoid the coral spikes.
4. Pick a jelly tint from the swatches. Use the pause and sound buttons as needed.

A very short tap launches toward the next platform with a forgiving default aim. A missed platform or spike hit ends the run; **ONE MORE RUN** restarts immediately.

## Snapchat host integration

- `SnapRouter` initializes `snapchat` once and checks `isSupported()` before storage, leaderboard, or Bitmoji use.
- Player berries, selected tint, and best score use `snapchat.storage` when available. The initial read completes before queued saves begin; writes are serialized and only triggered by meaningful state changes.
- The leaderboard submits an integer score using `snapchat.leaderboards.submitScore({ score })`, then opens the configured Lens leaderboard. Snap's current docs deprecate a `leaderboardId` parameter.
- When supported and a real avatar is present, the game requests the player's 2D Bitmoji. The local reaction portrait remains as fallback and responds with comedic panic when the jelly stretches.
- Sound is synthesized after a user gesture. Haptics are guarded and optional. Backgrounding suspends audio and pauses simulation updates.

## Publishing handoff

1. Test the production preview and touch input on a phone in portrait. Check performance, HUD safe areas, and the complete run/retry loop.
2. In Snap's **My Lenses**, create a Web Lens and upload `my-web-lens.zip`.
3. Add a centered 512 × 512 PNG icon and a 5-second 720 × 1280 MP4 preview (H.264 video, AAC audio, 30 fps).
4. Submit for review. A Lens can't be opened inside Snapchat until approved; every new upload goes through review again.

Do not treat browser stub checks as a substitute for a phone browser and approved in-Snap test.

## Technical notes

- WebGL rendering is capped at `Math.min(devicePixelRatio, 2)` and the frame delta is clamped to avoid background catch-up bursts.
- Input is pointer-based; long-press context menus and browser gestures are suppressed on the gameplay surface.
- The three-axis body spring uses damping 0.65 and a 0.38-second response target. Those are spring parameters, not a universal performance guarantee.
- The game is a polished stylized mobile 3D design, not an actual 8K texture workload. That keeps the archive and fill-rate appropriate for a phone WebView.

## Quick offline preview (no npm packages required)

Open `browser-preview.html` in a desktop or mobile browser, or unzip `jelly-jump-browser-preview.zip` and open its root `index.html`. This is a self-contained, dependency-free perspective Canvas 2D preview of the game loop and HUD, included so the interaction can still be tried while the npm registry is unreachable. It is **not** the production PlayCanvas build and does **not** include Snap's SDK bridge; the production implementation is the TypeScript app above. Browser-local preview settings are only for convenience and are not used by the Web Lens build.
