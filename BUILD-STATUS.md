# Jelly Jump build and verification status

Date: 2026-10-26

## Results from this environment

- `npm install`: **blocked**. The npm registry could not be resolved (`EAI_AGAIN` on the earlier attempt); a second attempt timed out. No `node_modules/` was created.
- `npm run typecheck`: **blocked** by missing installed packages: `playcanvas`, `@snap/web-lens-api`, and `vite`. The real dependency typings therefore have not been checked in this environment.
- `npm run build`: **blocked** because the Vite executable is not installed (`vite: not found`). No production `dist/` was generated.
- `npm run pack`: **blocked** because the `archiver` package is not installed. No production `my-web-lens.zip` was generated.
- `npm run verify`: **failed as expected** because `dist/index.html` does not exist before a production build.
- TypeScript state-machine test: **passed** with global `tsc`; checked boot → ready → aiming → launch → land → pause/resume → pop/game-over → replay transitions.
- Strict source check using temporary dependency shims: **passed earlier**, but is not a substitute for typechecking against the actual installed PlayCanvas/Snap SDK declarations.
- `node --check tools/pack.mjs`, `node --check tools/verify.mjs`, and `node --check browser-preview.js`: **passed**.
- Mobile-sized browser interaction harness (390 × 844): **passed** for title, instructions open/close, Play, tint selection, pause/resume, tap launch, drag aim preview, panic reaction, and landing progression from level 1 to 3. No JavaScript errors were observed in the harness.
- Direct Chromium navigation to local `file://` and localhost URLs: **blocked by this environment's browser policy** (`ERR_BLOCKED_BY_ADMINISTRATOR`). The successful browser check used inline HTML/CSS/JS instead, so it does not constitute a full production preview test.

## Files to use

- `browser-preview.html`: open directly in a browser for a dependency-free playable Canvas 2D game-loop preview.
- `jelly-jump-browser-preview.zip`: **16,478 bytes**; contains `index.html`, `styles.css`, and `game.js` at the ZIP root with relative references. This is the browser preview only, not a production Snapchat Lens upload.
- `jelly-jump-web-lens-source.zip`: source project archive, including PlayCanvas/Vite/TypeScript source, README, verification/packaging scripts, and a GitHub Actions workflow.

## GitHub status

No repository was visible to the connected GitHub account in the available repository listing, and this connector does not expose a create-repository operation. The files have **not** been pushed or committed to GitHub. The included `.github/workflows/build.yml` is ready to run checks after the source is pushed to a repository with Actions enabled and working npm registry access.

## Next commands when npm registry access is available

Run from this folder:

```powershell
npm install
npm run typecheck
npm run build
npm run pack
npm run verify
npm run preview
```

Only upload `my-web-lens.zip` after those production commands pass. The dependency-free preview ZIP is not the Snap upload artifact. Real-phone testing and testing inside an approved Snapchat Lens remain necessary.
