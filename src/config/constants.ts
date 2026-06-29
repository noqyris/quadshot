/**
 * Quadshot — central tunables.
 *
 * Every magic number lives here. Scenes, objects and systems import from this
 * file so the whole game can be re-balanced in one place.
 */

/** The four playable symbols — the classic controller face-button set. */
export enum Sym {
  TRIANGLE,
  CIRCLE,
  CROSS,
  SQUARE,
}

/** Pad / spawn order: triangle, circle, cross, square. */
export const ALL_SYMBOLS: Sym[] = [Sym.TRIANGLE, Sym.CIRCLE, Sym.CROSS, Sym.SQUARE];

/** Human-readable names (HUD legend, banners, accessibility). */
export const SYM_NAME: Record<Sym, string> = {
  [Sym.TRIANGLE]: "TRIANGLE",
  [Sym.CIRCLE]: "CIRCLE",
  [Sym.CROSS]: "CROSS",
  [Sym.SQUARE]: "SQUARE",
};

/**
 * Default 1:1 colour mapping. Colour is modelled independently of shape so a
 * future Phase 5 (match-by-colour) / Phase 6 (decoy colours) can break the
 * lock without touching the rest of the engine.
 */
export const COLORS: Record<Sym, number> = {
  [Sym.TRIANGLE]: 0x4ade80, // green
  [Sym.CIRCLE]: 0xf87171, //   red
  [Sym.CROSS]: 0x60a5fa, //    blue
  [Sym.SQUARE]: 0xf472b6, //   pink
};

/** The reference height the layout was tuned at (used to scale fall speed). */
export const DESIGN_HEIGHT = 800;

/** Logical-height clamp applied at startup when matching the device aspect. */
export const LAYOUT = {
  MIN_HEIGHT: 720,
  MAX_HEIGHT: 1180,
} as const;

/**
 * Gameplay / juice timing (ms) — the feel-affecting durations, gathered so the
 * whole game can be re-timed in one place. Purely cosmetic micro-flashes stay
 * inline at their tween for readability.
 */
export const TIMING = {
  SPAWN_GRACE: 900, //     hold new spawns at each phase start (rule-card breather)
  RULE_CARD_HOLD: 1900, // how long the rule card stays before it fades
  LOW_LIFE_PULSE: 900, //  half-cycle of the last-life danger frame
  GAMEOVER_HANG: 360, //   pause on the death shake before fading to game over
  SCENE_FADE: 260, //      scene fade in/out
} as const;

/**
 * Logical resolution. WIDTH is fixed at 480; HEIGHT is set once at startup
 * (main.ts) to match the device's available aspect ratio so the canvas fills
 * the screen with no letterbox. Vertical layout reads GAME.HEIGHT at runtime.
 */
export const GAME = {
  WIDTH: 480,
  HEIGHT: 800, // overwritten at startup
  BG: 0x070b1a,
  BG_HEX: "#070b1a",
};

/** Texture keys generated at boot from Graphics (no external art). */
export const TEX = {
  shape: (s: Sym) => `shape_${s}`,
  pad: "px_pad", //        rounded-rect menu/button texture
  padRound: "px_pad_round", // dark glossy round controller button body
  padRing: "px_pad_ring", //   colored neon rim+glow for the round pad
  particle: "px_particle",
  ring: "px_ring",
  glow: "px_glow",
} as const;

/** Falling targets. */
export const TARGET = {
  SIZE: 46, // logical diameter of the silhouette texture
  SPAWN_MARGIN: 46, // keep spawns this far from the play-field edges
  get MIN_X() {
    return this.SPAWN_MARGIN;
  },
  get MAX_X() {
    return GAME.WIDTH - this.SPAWN_MARGIN;
  },
} as const;

/** Player projectiles (fired straight up from a pad). */
export const PROJECTILE = {
  SIZE: 24,
  SPEED: 1050, // px/sec upward
} as const;

/**
 * The launcher: a row of four round, controller-style pads that wraps around
 * horizontally like an endless carousel. The four pads always span the screen
 * width (one per quarter); sliding scrolls them and any pad that leaves one
 * edge re-appears on the opposite edge.
 */
export const LAUNCHER = {
  PAD_D: 104, // on-screen size of a round pad (glow halo included)
  HIT_R: 44, // tap / press hit radius for a pad
  ICON_FRAC: 0.46, // symbol icon size as a fraction of PAD_D
  KEY_SPEED: 520, // px/sec carousel scroll via keyboard
  FIRE_COOLDOWN: 140, // ms between shots
  DRAG_THRESHOLD: 8, // px of movement that turns a tap into a drag
  /** Vertical centre of the pads — read from the (dynamic) game height. */
  get Y(): number {
    return GAME.HEIGHT - 74;
  },
  /** Horizontal period of the carousel = distance between adjacent pads. */
  get STEP(): number {
    return GAME.WIDTH / 4; // 120: four pads evenly span the width
  },
  /** Pad centres at scroll offset 0: one centred in each quarter (60,180,300,420). */
  get BASES(): number[] {
    const s = this.STEP;
    return [0, 1, 2, 3].map((i) => s / 2 + i * s);
  },
} as const;

/** The line a target must cross (downward) to count as a miss (dynamic height). */
export function missLineY(): number {
  return LAUNCHER.Y - LAUNCHER.PAD_D / 2 + 2;
}

/** Scoring / combo / lives. */
export const SCORE = {
  BASE_POINTS: 100,
  COMBO_PER_STEP: 3, // combo hits needed to raise the multiplier by 1
  MAX_MULTIPLIER: 5,
  START_LIVES: 3,
} as const;

/** Cross-mapping cycle (Phase 4): firing X destroys the next symbol in the ring. */
export const CROSS_CYCLE: Sym[] = [Sym.SQUARE, Sym.CIRCLE, Sym.TRIANGLE, Sym.CROSS];

export type MatchMode = "identity" | "cross" | "color";

export interface PhaseDef {
  index: number; // 1-based phase number
  scoreThreshold: number; // score at which this phase begins
  symbols: Sym[]; // symbols that may spawn / be fired
  mode: MatchMode;
  fallSpeed: number; // px/sec the targets fall (the speed tier)
  spawnInterval: number; // ms between spawns (the speed tier)
  banner: string; // headline shown when the phase starts
  subBanner?: string; // optional second line (rule explanation)
}

/** All four controller symbols are always in play; modes change the rule. */
const ALL_FOUR = [Sym.TRIANGLE, Sym.CIRCLE, Sym.CROSS, Sym.SQUARE];

/** The three speed tiers (fixed per phase — no continuous ramp). */
const SPEED = {
  SLOW: { fall: 175, spawn: 1450 },
  MEDIUM: { fall: 300, spawn: 1040 },
  FAST: { fall: 460, spawn: 760 },
} as const;

/** Display names for the three speed tiers (phases cycle through them in order). */
export const SPEED_NAMES = ["SLOW", "MEDIUM", "FAST"] as const;

/**
 * Endless run, 9 phases = 3 rules (shape → colour → cross) cycled at 3 speed
 * tiers. The same three rules play through at one speed, then repeat faster,
 * then fastest:
 *   1-3  SLOW    (shape, colour, cross)
 *   4-6  MEDIUM  (shape, colour, cross)
 *   7-9  FAST    (shape, colour, cross)
 */
export const PHASES: PhaseDef[] = [
  // --- Slow tier ---
  { index: 1, scoreThreshold: 0, symbols: ALL_FOUR, mode: "identity", fallSpeed: SPEED.SLOW.fall, spawnInterval: SPEED.SLOW.spawn, banner: "PHASE 1", subBanner: "MATCH THE SHAPE" },
  { index: 2, scoreThreshold: 1200, symbols: ALL_FOUR, mode: "color", fallSpeed: SPEED.SLOW.fall, spawnInterval: SPEED.SLOW.spawn, banner: "PHASE 2", subBanner: "MATCH THE COLOR" },
  { index: 3, scoreThreshold: 2600, symbols: ALL_FOUR, mode: "cross", fallSpeed: SPEED.SLOW.fall, spawnInterval: SPEED.SLOW.spawn, banner: "PHASE 3", subBanner: "CROSS-MATCH" },
  // --- Medium tier ---
  { index: 4, scoreThreshold: 4200, symbols: ALL_FOUR, mode: "identity", fallSpeed: SPEED.MEDIUM.fall, spawnInterval: SPEED.MEDIUM.spawn, banner: "PHASE 4", subBanner: "MATCH THE SHAPE  •  FASTER" },
  { index: 5, scoreThreshold: 6200, symbols: ALL_FOUR, mode: "color", fallSpeed: SPEED.MEDIUM.fall, spawnInterval: SPEED.MEDIUM.spawn, banner: "PHASE 5", subBanner: "MATCH THE COLOR  •  FASTER" },
  { index: 6, scoreThreshold: 8400, symbols: ALL_FOUR, mode: "cross", fallSpeed: SPEED.MEDIUM.fall, spawnInterval: SPEED.MEDIUM.spawn, banner: "PHASE 6", subBanner: "CROSS-MATCH  •  FASTER" },
  // --- Fast tier ---
  { index: 7, scoreThreshold: 10800, symbols: ALL_FOUR, mode: "identity", fallSpeed: SPEED.FAST.fall, spawnInterval: SPEED.FAST.spawn, banner: "PHASE 7", subBanner: "MATCH THE SHAPE  •  FASTEST" },
  { index: 8, scoreThreshold: 13600, symbols: ALL_FOUR, mode: "color", fallSpeed: SPEED.FAST.fall, spawnInterval: SPEED.FAST.spawn, banner: "PHASE 8", subBanner: "MATCH THE COLOR  •  FASTEST" },
  { index: 9, scoreThreshold: 16800, symbols: ALL_FOUR, mode: "cross", fallSpeed: SPEED.FAST.fall, spawnInterval: SPEED.FAST.spawn, banner: "PHASE 9", subBanner: "CROSS-MATCH  •  FASTEST" },
];

/** Storage keys for persisted state. */
export const STORE_KEYS = {
  BEST: "quadshot.best",
  MUTE: "quadshot.mute",
  HAPTICS: "quadshot.haptics",
  STATS: "quadshot.stats",
  SCORES: "quadshot.scores",
  TUTORIAL: "quadshot.tutorialSeen",
  ADS_REMOVED: "quadshot.adsRemoved",
} as const;

/**
 * Monetization tunables. `ENABLED` gates all ad UI (banner placeholder +
 * remove-ads). The actual ad network / IAP wiring lives in Monetization.ts,
 * behind safe fallbacks — see docs for the native AdMob + store IAP setup.
 */
export const MONETIZATION = {
  // v1 ships with NO ads/IAP (clean launch, matches the "100% offline" listing).
  // Flip to true once AdMob + StoreKit/Play Billing are wired (see STORE_LISTING).
  ENABLED: false,
  REMOVE_ADS_PRICE: "$0.99",
  MAX_CONTINUES: 1, // ad-revives allowed per run
} as const;

/** Viral share loop. Replace URL with the real App Store / landing link. */
export const SHARE = {
  TITLE: "Quadshot",
  URL: "https://quadshot.app", // TODO: your App Store / landing link
  hook: (score: number) =>
    `I scored ${score.toLocaleString()} in QUADSHOT 🎮 reflex arcade. Can you beat me?`,
} as const;

/** How many local high scores to keep. */
export const HIGH_SCORE_COUNT = 5;

/** Scene keys. */
export const SCENES = {
  BOOT: "BootScene",
  MENU: "MenuScene",
  GAME: "GameScene",
  GAME_OVER: "GameOverScene",
} as const;

/** Shared UI palette. */
export const UI = {
  TEXT: "#e6edf6",
  TEXT_DIM: "#8b98b3",
  ACCENT: "#5eead4",
  DANGER: "#fb7185",
  FONT: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
} as const;

/**
 * Dev-only tools (in-game phase switcher + slow-motion). Shown only when
 * `ENABLED` is true — a plain constant so it also works in the packaged
 * iOS/Android build. SET `ENABLED` TO false BEFORE RELEASE.
 */
export const DEV = {
  // OFF for release builds. Flip to true while developing to get the in-game
  // phase-jumper + slow-mo + on-screen error overlay; keep false for any build
  // you ship or upload to TestFlight / Play.
  ENABLED: false,
  /** Gameplay time-scale presets (1 = full speed; lower = slower for testing). */
  SPEEDS: [1, 0.75, 0.5, 0.35] as const,
  DEFAULT_SPEED_INDEX: 2, // 0.5×
} as const;
