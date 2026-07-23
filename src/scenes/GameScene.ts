import Phaser from "phaser";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  ALL_SYMBOLS,
  CLIMB,
  COLORS,
  DEV,
  GAME,
  missLineY,
  MONETIZATION,
  PROJECTILE,
  PhaseDef,
  SCENES,
  Sym,
  TEX,
  TIMING,
  UI,
} from "../config/constants";
import { Launcher, FireEvent } from "../objects/Launcher";
import { Projectile } from "../objects/Projectile";
import { Target } from "../objects/Target";
import { Difficulty } from "../systems/Difficulty";
import { Haptics } from "../systems/Haptics";
import { MatchRules } from "../systems/MatchRules";
import { ScoreManager } from "../systems/ScoreManager";
import { Sfx } from "../systems/Sfx";
import { Spawner } from "../systems/Spawner";
import { Storage } from "../systems/Storage";
import { createBackground } from "../ui/Background";
import { Hud } from "../ui/Hud";

/** The main game loop: spawning, firing, collisions, scoring, juice, game over. */
export class GameScene extends Phaser.Scene {
  private launcher!: Launcher;
  private difficulty!: Difficulty;
  private scoreMgr!: ScoreManager;
  private spawner!: Spawner;
  private hud!: Hud;

  private targets!: Phaser.GameObjects.Group;
  private projectiles!: Phaser.GameObjects.Group;
  // Keyed by symbol (one emitter per shape) — the shape is what drives match
  // logic, so look-ups read the same field everywhere instead of a colour value.
  private burstEmitters = new Map<Sym, Phaser.GameObjects.Particles.ParticleEmitter>();
  private muzzleEmitters = new Map<Sym, Phaser.GameObjects.Particles.ParticleEmitter>();

  private running = false;
  private paused = false;

  // Per-run stats.
  private kills = 0;
  private maxCombo = 0;
  private continuesUsed = 0;

  // Hold new spawns until this scene-time (ms) — a breather on each phase start.
  private spawnGraceUntil = 0;

  // Per-phase "climb": how far (logical px) the launcher + miss line have risen.
  private climb = 0;
  private missLineGfx!: Phaser.GameObjects.Graphics;

  // Persistent danger frame shown on the last life.
  private lowLifeFrame!: Phaser.GameObjects.Rectangle;

  // Pause UI.
  private pauseLayer?: Phaser.GameObjects.Container;
  private appStateHandle?: PluginListenerHandle;
  private isShutdown = false;

  // Dev tools (only active when DEV.ENABLED).
  private devSpeedIndex: number = DEV.DEFAULT_SPEED_INDEX;
  private devSpeedLabel?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.GAME);
  }

  /** Gameplay time-scale: 1 in release, a slow-mo preset when dev tools are on. */
  private get devTimeScale(): number {
    return DEV.ENABLED ? DEV.SPEEDS[this.devSpeedIndex] : 1;
  }

  create(data?: { resume?: { score: number; kills: number; maxCombo: number; continues: number } }): void {
    createBackground(this);
    this.cameras.main.fadeIn(220, 7, 11, 26);
    this.drawMissLine();
    const resume = data?.resume;

    // Systems.
    this.difficulty = new Difficulty();
    this.scoreMgr = new ScoreManager();

    // Pools.
    this.targets = this.add.group({
      classType: Target,
      maxSize: 64,
      runChildUpdate: false,
    });
    this.projectiles = this.add.group({
      classType: Projectile,
      maxSize: 32,
      runChildUpdate: false,
    });
    this.spawner = new Spawner(this.targets);

    this.buildEmitters();

    // Launcher.
    this.launcher = new Launcher(this);
    this.launcher.onFire = (e) => this.fireProjectile(e);

    // HUD.
    this.hud = new Hud(this);
    this.hud.setLives(this.scoreMgr.lives);
    this.hud.initScore(0);
    void Storage.getBestScore().then((b) => this.hud.setBest(b));

    // Per-run state — seeded from `resume` when continuing after a revive.
    this.kills = resume?.kills ?? 0;
    this.maxCombo = resume?.maxCombo ?? 0;
    this.continuesUsed = resume?.continues ?? 0;
    this.paused = false;
    this.buildLowLifeFrame();

    // Phase wiring.
    this.difficulty.onPhaseChange = (phase) => this.onPhaseChange(phase);
    let phaseShown = false;
    if (resume) {
      this.scoreMgr.score = resume.score;
      this.hud.initScore(resume.score);
      // Advance the phase to match the resumed score (fires onPhaseChange → card).
      this.difficulty.update(0, resume.score);
      phaseShown = this.difficulty.getPhase().index !== 1;
    }
    if (!phaseShown) this.applyPhase(this.difficulty.getPhase());

    this.running = true;

    this.buildPauseButton();
    this.bindAutoPause();
    if (DEV.ENABLED) this.buildDevPanel();

    // Clean up input listeners when the scene is torn down / restarted.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.onShutdown());
  }

  private buildLowLifeFrame(): void {
    this.lowLifeFrame = this.add
      .rectangle(GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH - 4, GAME.HEIGHT - 4)
      .setStrokeStyle(5, 0xfb4d6a, 1)
      .setDepth(95)
      .setVisible(false)
      .setAlpha(0);
  }

  private drawMissLine(): void {
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(2, 0xff5577, 0.18);
    const y = missLineY();
    g.lineBetween(0, y, GAME.WIDTH, y);
    this.missLineGfx = g; // moved up as the rack climbs each phase
  }

  private buildEmitters(): void {
    ALL_SYMBOLS.forEach((shape) => {
      const color = COLORS[shape];
      const burst = this.add
        .particles(0, 0, TEX.particle, {
          speed: { min: 120, max: 340 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.7, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: { min: 280, max: 620 },
          blendMode: Phaser.BlendModes.ADD,
          tint: color,
          emitting: false,
        })
        .setDepth(15);
      this.burstEmitters.set(shape, burst);

      const muzzle = this.add
        .particles(0, 0, TEX.particle, {
          speed: { min: 100, max: 240 },
          angle: { min: -110, max: -70 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 0.9, end: 0 },
          lifespan: { min: 140, max: 300 },
          blendMode: Phaser.BlendModes.ADD,
          tint: color,
          emitting: false,
        })
        .setDepth(15);
      this.muzzleEmitters.set(shape, muzzle);
    });
  }

  // --- Firing -----------------------------------------------------------------

  private fireProjectile(e: FireEvent): void {
    if (!this.running || this.paused) return;
    // Runs from the input event (not update), so guard it too — a throw here
    // would otherwise break the loop and look like "can't fire".
    try {
      const proj = this.projectiles.get() as Projectile | null;
      if (!proj) return;
      proj.fire(e.x, e.y, e.shape, e.color);
      proj.setDepth(8);
      this.muzzleEmitters.get(e.shape)?.explode(8, e.x, e.y);
      Sfx.fire();
      Haptics.fire();
    } catch (err) {
      this.reportFrameError(err);
    }
  }

  // --- Phases -----------------------------------------------------------------

  private applyPhase(phase: PhaseDef): void {
    // All four controller pads stay lit at all times; the legend is the small,
    // always-on reminder, and the rule card explains the phase prominently.
    this.hud.setLegend(phase);
    this.hud.showRuleCard(phase);
    // Brief breather: hold new spawns so the rule card is readable / fair.
    this.spawnGraceUntil = this.time.now + TIMING.SPAWN_GRACE;
    // Climb: raise the rack + miss line a little more each phase so obstacles
    // have less distance (and time) to travel.
    this.climb = Math.min(CLIMB.MAX, (phase.index - 1) * CLIMB.PER_PHASE);
    this.launcher.setLift(this.climb);
    this.tweens.add({ targets: this.missLineGfx, y: -this.climb, duration: 400, ease: "Quad.out" });
  }

  private onPhaseChange(phase: PhaseDef): void {
    this.applyPhase(phase);
    // A celebratory surge on phase-up: a teal camera flash, a brief full-screen
    // cyan wash, the pad rims flaring, an ascending chime, and haptics.
    this.cameras.main.flash(220, 26, 90, 110);
    const wash = this.add
      .rectangle(GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x5eead4, 0.16)
      .setDepth(90)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: wash,
      alpha: 0,
      duration: 420,
      ease: "Quad.in",
      onComplete: () => wash.destroy(),
    });
    this.launcher.flarePads();
    Sfx.phaseUp();
    Haptics.phaseUp();
  }

  // --- Main loop --------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (!this.running || this.paused) return;
    // Hard guard: a single per-frame exception must never break the RAF loop
    // (that would freeze movement and make it look like "can't fire").
    try {
      const realDt = delta / 1000;
      // Slow-mo (dev) scales the gameplay clock but NOT launcher input, so the
      // rack stays responsive while targets/projectiles/spawns slow down.
      const gameDelta = delta * this.devTimeScale;
      const gameDt = gameDelta / 1000;

      this.difficulty.update(gameDelta, this.scoreMgr.score);
      if (this.time.now >= this.spawnGraceUntil) {
        this.spawner.update(gameDelta, this.difficulty);
      }
      this.launcher.update(realDt);

      this.moveProjectiles(gameDt);
      this.moveTargetsAndDetectMisses(gameDt);
      this.resolveCollisions();
    } catch (err) {
      this.reportFrameError(err);
    }
  }

  private frameErrorShown = false;
  /** Log a per-frame error (and surface it on-screen in dev) without freezing. */
  private reportFrameError(err: unknown): void {
    const msg = err instanceof Error ? `${err.message}` : String(err);
    // eslint-disable-next-line no-console
    console.error("[Quadshot] frame error:", err);
    if (DEV.ENABLED && !this.frameErrorShown) {
      this.frameErrorShown = true;
      this.add
        .text(8, GAME.HEIGHT * 0.5, `ERR: ${msg}`, {
          fontFamily: UI.FONT,
          fontSize: "12px",
          color: "#ff7070",
          fontStyle: "bold",
          wordWrap: { width: GAME.WIDTH - 16 },
        })
        .setDepth(300)
        .setResolution(2);
    }
  }

  private moveProjectiles(dt: number): void {
    for (const obj of this.projectiles.getChildren()) {
      const p = obj as Projectile;
      if (!p.active) continue;
      p.advance(dt);
      if (p.y < -PROJECTILE.SIZE) p.deactivate();
    }
  }

  private moveTargetsAndDetectMisses(dt: number): void {
    for (const obj of this.targets.getChildren()) {
      const t = obj as Target;
      if (!t.active) continue;
      t.advance(dt);
      if (t.y >= missLineY() - this.climb) this.handleMiss(t);
    }
  }

  private resolveCollisions(): void {
    const mode = this.difficulty.getMode();
    const cross = this.difficulty.getCrossTier();
    for (const pObj of this.projectiles.getChildren()) {
      const p = pObj as Projectile;
      if (!p.active) continue;
      for (const tObj of this.targets.getChildren()) {
        const t = tObj as Target;
        if (!t.active) continue;
        // Type-locked: only matching pairs can interact; all others pass through.
        if (!MatchRules.canKill(p, t, mode, cross)) continue;
        const rr = p.hitRadius + t.hitRadius;
        const dx = p.x - t.x;
        const dy = p.y - t.y;
        if (dx * dx + dy * dy <= rr * rr) {
          this.handleKill(p, t);
          break; // projectile consumed
        }
      }
    }
  }

  // --- Outcomes ---------------------------------------------------------------

  private handleKill(proj: Projectile, target: Target): void {
    const { x, y, color, shape } = target;
    const result = this.scoreMgr.registerKill();
    this.kills += 1;
    this.maxCombo = Math.max(this.maxCombo, result.combo);

    proj.deactivate();
    target.deactivate();

    // Juice scales up with the multiplier so streaks feel bigger.
    const m = Math.min(result.multiplier, 5);
    const burst = 12 + m * 5;
    this.burstEmitters.get(shape)?.explode(burst, x, y);
    this.spawnRing(x, y, color, result.multiplier);
    this.spawnScorePopup(x, y, result.points, color);

    this.hud.setScore(this.scoreMgr.score);
    this.hud.setCombo(result.combo, result.multiplier);
    this.hud.pulseCombo();
    Sfx.match(result.combo);

    // Streak banner every 10 hits without a miss.
    if (result.combo > 0 && result.combo % 10 === 0) this.showStreak(result.combo);
  }

  private handleMiss(target: Target): void {
    target.deactivate();
    const lives = this.scoreMgr.registerMiss();

    this.hud.setLives(lives);
    this.hud.setCombo(this.scoreMgr.combo, this.scoreMgr.multiplier);
    this.cameras.main.shake(200, 0.009);
    this.cameras.main.flash(200, 70, 12, 22); // softer red flash
    Sfx.miss();
    Haptics.miss();
    this.updateLowLife(lives);

    if (this.scoreMgr.isGameOver) this.endGame();
  }

  private showStreak(combo: number): void {
    const t = this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT * 0.5, `STREAK  ×${combo}`, {
        fontFamily: UI.FONT,
        fontSize: "34px",
        color: UI.ACCENT,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(112)
      .setShadow(0, 0, UI.ACCENT, 16, true, true);
    this.tweens.add({
      targets: t,
      scale: { from: 0.6, to: 1.1 },
      duration: 220,
      ease: "Back.out",
    });
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 500,
      duration: 380,
      onComplete: () => t.destroy(),
    });
  }

  /** Subtle, moderate red danger frame while on the last life. */
  private updateLowLife(lives: number): void {
    if (lives === 1) {
      this.tweens.killTweensOf(this.lowLifeFrame); // never stack the infinite pulse
      this.lowLifeFrame.setVisible(true);
      this.tweens.add({
        targets: this.lowLifeFrame,
        alpha: { from: 0.1, to: 0.3 },
        duration: TIMING.LOW_LIFE_PULSE,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    } else {
      this.tweens.killTweensOf(this.lowLifeFrame);
      this.lowLifeFrame.setVisible(false).setAlpha(0);
    }
  }

  // --- Juice ------------------------------------------------------------------

  private spawnRing(x: number, y: number, color: number, multiplier = 1): void {
    const ring = this.add
      .image(x, y, TEX.ring)
      .setTint(color)
      .setDepth(14)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: 1.3 + Math.min(multiplier, 5) * 0.12, // bigger ring on higher combo
      alpha: 0,
      duration: 440,
      ease: "Quad.out",
      onComplete: () => ring.destroy(),
    });
  }

  private spawnScorePopup(x: number, y: number, points: number, color: number): void {
    const popup = this.add
      .text(x, y, `+${points}`, {
        fontFamily: UI.FONT,
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(110)
      .setTint(color);
    this.tweens.add({
      targets: popup,
      y: y - 56,
      alpha: 0,
      duration: 650,
      ease: "Quad.out",
      onComplete: () => popup.destroy(),
    });
  }

  // --- Game over --------------------------------------------------------------

  private endGame(): void {
    this.running = false;
    this.launcher.setEnabled(false);
    Sfx.gameOver();
    Haptics.gameOver();
    this.cameras.main.shake(360, 0.02);

    // The run is recorded by GameOverScene only if the player does NOT continue,
    // so an ad-revive keeps the same run going instead of double-counting.
    const run = {
      score: this.scoreMgr.score,
      kills: this.kills,
      bestCombo: this.maxCombo,
      phase: this.difficulty.getPhase().index,
    };
    const canContinue =
      MONETIZATION.ENABLED && this.continuesUsed < MONETIZATION.MAX_CONTINUES;

    this.time.delayedCall(TIMING.GAMEOVER_HANG, () => {
      this.cameras.main.fadeOut(TIMING.SCENE_FADE, 7, 11, 26);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENES.GAME_OVER, { run, canContinue, continues: this.continuesUsed });
      });
    });
  }

  // --- Pause / auto-pause -----------------------------------------------------

  private buildPauseButton(): void {
    const btn = this.add
      .text(GAME.WIDTH - 14, 14, "❚❚", {
        fontFamily: UI.FONT,
        fontSize: "20px",
        color: UI.TEXT_DIM,
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setResolution(2)
      .setDepth(96)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerup", () => this.pauseGame());
    this.input.keyboard?.on("keydown-P", () => this.togglePause());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
  }

  private bindAutoPause(): void {
    // On native, the OS background/foreground signal is the reliable one.
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) this.pauseGame();
    }).then((h) => {
      // If the scene already shut down before this resolved, remove immediately
      // so the native listener can't outlive the scene (it would accumulate
      // across restarts and call pauseGame on a dead scene).
      if (this.isShutdown) void h.remove();
      else this.appStateHandle = h;
    });
    // Phaser BLUR can fire spuriously on iOS (audio session / focus changes), so
    // only use it on the web where tab-switch focus loss is meaningful.
    if (!Capacitor.isNativePlatform()) {
      this.game.events.on(Phaser.Core.Events.BLUR, this.pauseGame, this);
    }
  }

  private togglePause(): void {
    if (this.paused) this.resumeGame();
    else this.pauseGame();
  }

  private pauseGame(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.launcher.setEnabled(false);
    this.showPauseLayer();
  }

  private resumeGame(): void {
    if (!this.paused) return;
    this.paused = false;
    this.launcher.setEnabled(true);
    this.pauseLayer?.destroy();
    this.pauseLayer = undefined;
    Sfx.unlock(); // resume audio context after returning to the game
  }

  private showPauseLayer(): void {
    if (this.pauseLayer) return;
    const cx = GAME.WIDTH / 2;
    const c = this.add.container(0, 0).setDepth(160);
    const dim = this.add
      // Noticeably darker than the play-field background so "paused" reads clearly
      // (the old 0x05070f was within ~1 RGB step of the bg and barely visible).
      .rectangle(cx, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x02040c, 0.86)
      .setInteractive(); // swallow taps behind the menu
    const glow = this.add
      .image(cx, GAME.HEIGHT * 0.36, TEX.bloom)
      .setTint(0x5eead4)
      .setAlpha(0.14)
      .setScale(2.2, 1.4)
      .setBlendMode(Phaser.BlendModes.ADD);
    const title = this.add
      .text(cx, GAME.HEIGHT * 0.36, "PAUSED", {
        fontFamily: UI.FONT,
        fontSize: "46px",
        color: UI.TEXT,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(3)
      .setShadow(0, 0, UI.ACCENT, 18, true, true);
    const buttons = [
      this.pauseMenuButton(GAME.HEIGHT * 0.5, "RESUME", () => this.resumeGame()),
      this.pauseMenuButton(GAME.HEIGHT * 0.62, "RESTART", () => {
        this.resumeGame();
        this.scene.restart();
      }),
      this.pauseMenuButton(GAME.HEIGHT * 0.74, "MENU", () => {
        this.scene.start(SCENES.MENU);
      }),
    ];
    c.add([dim, glow, title, ...buttons]);
    this.pauseLayer = c;

    // Quick entrance: scrim + title pop, buttons float up in sequence.
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.86, duration: 160, ease: "Quad.out" });
    title.setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 240, ease: "Back.out" });
    buttons.forEach((b, i) => {
      b.setAlpha(0);
      b.y += 16;
      this.tweens.add({ targets: b, alpha: 1, y: b.y - 16, delay: 80 + i * 70, duration: 200, ease: "Quad.out" });
    });
  }

  private pauseMenuButton(y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(GAME.WIDTH / 2, y, label, {
        fontFamily: UI.FONT,
        fontSize: "26px",
        color: UI.ACCENT,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });
    t.on("pointerup", onClick);
    return t;
  }

  private onShutdown(): void {
    this.isShutdown = true;
    this.launcher.destroy();
    this.appStateHandle?.remove();
    this.appStateHandle = undefined;
    this.game.events.off(Phaser.Core.Events.BLUR, this.pauseGame, this);
    // Phaser destroys the emitter GameObjects + pause-layer children (and their
    // listeners) on scene shutdown; just drop our references to them here.
    this.burstEmitters.clear();
    this.muzzleEmitters.clear();
  }

  // --- Dev tools (only built when DEV.ENABLED) --------------------------------

  private buildDevPanel(): void {
    // 3×3 grid mirroring the phase layout: rows = speed tiers (S/M/F),
    // columns = rules (shape / colour / cross). Button label = phase number.
    const x0 = 36;
    const y0 = 108;
    const cw = 34;
    const rh = 30;
    const tiers = ["S", "M", "F"];

    this.add
      .text(10, y0 - 20, "DEV — JUMP TO PHASE", {
        fontFamily: UI.FONT,
        fontSize: "10px",
        color: UI.TEXT_DIM,
        fontStyle: "bold",
      })
      .setDepth(130)
      .setResolution(2);

    for (let row = 0; row < 3; row++) {
      this.add
        .text(14, y0 + row * rh, tiers[row], {
          fontFamily: UI.FONT,
          fontSize: "10px",
          color: UI.TEXT_DIM,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(130)
        .setResolution(2);
      for (let col = 0; col < 3; col++) {
        const index = row * 3 + col + 1;
        this.makeDevButton(x0 + col * cw, y0 + row * rh, 28, String(index), () =>
          this.devJumpToPhase(index)
        );
      }
    }

    // Slow-motion cycle button (testing aid, separate from the phase speed tiers).
    this.devSpeedLabel = this.makeDevButton(
      x0 + 3 * cw + 30,
      y0 + rh,
      56,
      `${this.devTimeScale}×`,
      () => this.devCycleSpeed()
    );
  }

  private makeDevButton(
    x: number,
    y: number,
    w: number,
    label: string,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const bg = this.add
      .rectangle(x, y, w, 28, 0x141d33, 0.92)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x5eead4, 0.55)
      .setDepth(130)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, {
        fontFamily: UI.FONT,
        fontSize: "13px",
        color: UI.ACCENT,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(131)
      .setResolution(2);
    bg.on("pointerup", onClick);
    return txt;
  }

  private devJumpToPhase(index: number): void {
    this.difficulty.devForcePhase(index);
    this.clearTargets();
    this.scoreMgr.combo = 0;
    this.hud.setCombo(0, this.scoreMgr.multiplier);
    this.applyPhase(this.difficulty.getPhase());
    this.cameras.main.flash(160, 30, 60, 90);
  }

  private devCycleSpeed(): void {
    this.devSpeedIndex = (this.devSpeedIndex + 1) % DEV.SPEEDS.length;
    this.devSpeedLabel?.setText(`${this.devTimeScale}×`);
  }

  private clearTargets(): void {
    for (const obj of this.targets.getChildren()) {
      const t = obj as Target;
      if (t.active) t.deactivate();
    }
  }
}
