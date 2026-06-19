# Quadshot

A fast-paced 2D arcade reflex game. A horizontal rack of four symbol pads slides
left–right along the bottom; fire a symbol straight up to destroy matching
symbols falling from the top. Endless run with escalating difficulty, score,
combo multiplier, and lives.

Built with **Phaser 3 + TypeScript + Vite**, and packaged to **iOS** and
**Android** from one codebase with **Capacitor**.

All visuals are drawn procedurally with Phaser `Graphics` (no external art) and
all SFX are generated at runtime via Web Audio — the game is fully
self-contained. No PlayStation/Sony symbols, colors, or references are used.

## Quick start

```bash
npm install
npm run dev        # play in the browser (http://localhost:5173)
npm run build      # type-check + bundle to dist/
npm run preview    # serve the production build
```

## How to play

- **Touch:** drag anywhere to slide the rack; tap a pad to fire its symbol.
- **Keyboard:** `←/→` or `A/D` to move; `1`–`4` to fire pads 1–4; `Enter`/`Space`
  to start / play again.
- Destroy a falling symbol with the matching pad before it crosses the bottom
  line. A miss costs a life — you have three.

A projectile only interacts with targets it can destroy; it passes through
everything else (type-locked, no blocking).

### Phases (endless — 9 phases)

All four controller symbols (△ ○ ✕ □) are always in play. The run cycles the
three **rules** at three fixed **speed tiers** — the same three rules play
through at one speed, then repeat faster, then fastest:

| Phase | Score | Rule | Speed |
| ----- | ----- | ---- | ----- |
| 1 | 0 | match shape | slow |
| 2 | 1,200 | match colour | slow |
| 3 | 2,600 | cross-match | slow |
| 4 | 4,200 | match shape | medium |
| 5 | 6,200 | match colour | medium |
| 6 | 8,400 | cross-match | medium |
| 7 | 10,800 | match shape | fast |
| 8 | 13,600 | match colour | fast |
| 9 | 16,800 | cross-match | fast |

Rules: **match shape** (hit the same symbol), **match colour** (shape is a
decoy — hit by colour), **cross-match** (`□→○`, `○→△`, `△→✕`, `✕→□`). Each phase
has a fixed speed (no continuous ramp). Scoring: `100 × multiplier`, where
`multiplier = clamp(1 + floor(combo / 3), 1, 5)`.

### Dev tools

Set `DEV.ENABLED` in [`src/config/constants.ts`](src/config/constants.ts) (on
by default during development; **set to `false` before release**). When on, the
GameScene shows a small top-left **3×3 grid** (rows = speed S/M/F, columns =
rule) — tap `1`–`9` to jump straight to any phase, and tap the `×` button to
cycle a slow-motion time-scale (1 → 0.75 → 0.5 → 0.35). Slow-mo never affects
rack control, only the falling pace.

## Project structure

```
src/
  main.ts                 Phaser config + scene list
  config/constants.ts     ALL tunables: sizes, speeds, phases, scoring, colors, cycle
  scenes/   BootScene  MenuScene  GameScene  GameOverScene
  objects/  Launcher  Target  Projectile
  systems/  Spawner  Difficulty  MatchRules  ScoreManager  Storage  Sfx
  ui/       Hud  Background
```

Every magic number lives in [`src/config/constants.ts`](src/config/constants.ts)
— re-balance the whole game there.

### Extensibility

Targets model `shape` and `color` independently (v1 locks them 1:1). The kill
engine is a single pluggable rule — `MatchRules.canKill(projShape, target, mode)`
— which already generalizes identity and cross-cycle. Adding **Phase 5**
(match-by-color) or **Phase 6** (decoy colors) means adding a `mode`, not
rewriting the engine.

## Native packaging (Capacitor)

The iOS and Android projects are already generated under `ios/` and `android/`
(`appId: com.bysubotic.quadshot`). After changing web code:

```bash
npm run build
npx cap sync
npx cap open ios        # opens Xcode
npx cap open android    # opens Android Studio
```

If you clone fresh and the native folders are missing, recreate them with
`npx cap add ios` / `npx cap add android`.

Requirements: iOS needs Xcode + CocoaPods; Android needs Android Studio (JDK +
Android SDK).

### Persistence

`Storage` uses `@capacitor/preferences` on native and falls back to
`localStorage` on the web. Best score and the mute setting persist across
launches.

### Icons & splash

v1 ships with Capacitor's default launch assets. To generate branded
icons/splash later, drop a 1024×1024 source into `resources/` and run
[`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets).

## Notes

- `window.game` exposes the Phaser game instance for debugging.
- Rendering uses WebGL where available (all modern browsers and Capacitor
  WebViews), falling back to Canvas.
