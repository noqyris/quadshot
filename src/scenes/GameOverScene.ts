import Phaser from "phaser";
import { GAME, HIGH_SCORE_COUNT, SCENES, TEX, UI } from "../config/constants";
import { createBackground } from "../ui/Background";
import { showBanner } from "../ui/Banner";
import { Monetization } from "../systems/Monetization";
import { RunResult, Storage } from "../systems/Storage";
import { Share } from "../systems/Share";
import { Sfx } from "../systems/Sfx";

interface GameOverData {
  run: RunResult;
  canContinue: boolean;
  continues: number;
}

/**
 * Final score, run stats, local high-score table, and the end-of-run choices.
 * If eligible, the player can watch a rewarded ad to CONTINUE the same run
 * (revive); the run is only recorded to stats/high-scores once they decline.
 */
export class GameOverScene extends Phaser.Scene {
  private run!: RunResult;
  private continues = 0;
  private recorded = false;
  private busy = false; // guards the async continue flow against double-taps

  constructor() {
    super(SCENES.GAME_OVER);
  }

  create(data: GameOverData): void {
    this.run = data?.run ?? { score: 0, kills: 0, bestCombo: 0, phase: 1 };
    this.continues = data?.continues ?? 0;
    this.recorded = false;
    const canContinue = data?.canContinue ?? false;

    createBackground(this);
    this.cameras.main.fadeIn(280, 7, 11, 26);

    // Score-dependent UI needs the stored best/scores, so build after loading.
    void Promise.all([Storage.getBestScore(), Storage.getHighScores()]).then(
      ([storedBest, storedScores]) => this.build(storedBest, storedScores, canContinue)
    );
  }

  private build(storedBest: number, storedScores: number[], canContinue: boolean): void {
    const H = GAME.HEIGHT;
    const { score, kills, bestCombo, phase } = this.run;
    const isNewBest = score > storedBest && score > 0;

    const title = this.center(H * 0.155, "GAME OVER", 50, UI.TEXT);
    title.setShadow(0, 0, UI.DANGER, 22, true, true);
    if (title.width > GAME.WIDTH - 56) title.setScale((GAME.WIDTH - 56) / title.width);

    this.center(H * 0.235, "SCORE", 14, UI.TEXT_DIM);
    this.center(H * 0.278, score.toLocaleString(), 46, UI.TEXT).setResolution(3);
    this.center(
      H * 0.342,
      isNewBest ? "★ NEW BEST ★" : `BEST  ${Math.max(storedBest, score).toLocaleString()}`,
      18,
      isNewBest ? UI.ACCENT : UI.TEXT_DIM
    );
    const stats = this.center(
      H * 0.388,
      `PHASE ${phase}   •   ${kills} HITS   •   BEST COMBO ×${bestCombo}`,
      13,
      UI.TEXT_DIM
    );
    if (stats.width > GAME.WIDTH - 32) stats.setScale((GAME.WIDTH - 32) / stats.width);

    // High-score table (this run merged in for display; persisted on decline).
    // When the continue CTA is shown there's an extra button in the stack, so we
    // show a compact table to avoid colliding with it on short screens (H≈720).
    this.center(H * 0.44, "HIGH SCORES", 13, UI.TEXT_DIM);
    const rowsToShow = canContinue ? 3 : HIGH_SCORE_COUNT;
    const display = [...storedScores, score].sort((a, b) => b - a).slice(0, rowsToShow);
    let highlighted = false;
    display.forEach((s, i) => {
      const isThisRun = !highlighted && s === score;
      if (isThisRun) highlighted = true;
      this.center(
        H * 0.47 + i * 22,
        `${i + 1}.   ${s.toLocaleString()}`,
        16,
        isThisRun ? UI.ACCENT : UI.TEXT,
        isThisRun ? "bold" : "normal"
      );
    });

    // Choices — continue (rewarded) is the encouraged CTA when eligible.
    const shareData = { score, best: Math.max(storedBest, score), phase, isNewBest };
    if (canContinue) {
      this.makeButton(H * 0.61, "WATCH AD & CONTINUE", () => this.continueRun(), {
        w: 264,
        fontSize: 18,
        filled: true,
      });
      this.makeButton(H * 0.69, "SHARE  ↗", () => this.share(shareData), { filled: true });
      this.makeButton(H * 0.77, "PLAY AGAIN", () => this.playAgain(), { filled: false });
      this.linkButton(H * 0.85, "MENU", () => this.toMenu());
    } else {
      this.makeButton(H * 0.655, "SHARE  ↗", () => this.share(shareData), { filled: true });
      this.makeButton(H * 0.735, "PLAY AGAIN", () => this.playAgain(), { filled: false });
      this.linkButton(H * 0.815, "MENU", () => this.toMenu());
    }

    showBanner(this); // bottom ad banner (placeholder) when ads are active

    this.input.keyboard?.once("keydown-ENTER", () => this.playAgain());
    this.input.keyboard?.once("keydown-SPACE", () => this.playAgain());
  }

  // --- Flow -------------------------------------------------------------------

  private share(data: { score: number; best: number; phase: number; isNewBest: boolean }): void {
    Sfx.unlock();
    void Share.shareScore(data);
  }

  private async continueRun(): Promise<void> {
    if (this.busy) return; // ignore re-taps while the ad is resolving
    this.busy = true;
    Sfx.unlock();
    let rewarded = false;
    try {
      rewarded = await Monetization.showRewarded();
    } catch {
      rewarded = false; // a real ad SDK could reject/throw — treat as no reward
    }
    if (!rewarded) {
      this.busy = false; // ad unavailable / dismissed — re-enable the screen
      return;
    }
    this.cameras.main.fadeOut(200, 7, 11, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.GAME, {
        resume: {
          score: this.run.score,
          kills: this.run.kills,
          maxCombo: this.run.bestCombo,
          continues: this.continues + 1,
        },
      });
    });
  }

  /** Persist the finished run exactly once (only when the player gives up). */
  private finalize(): Promise<unknown> {
    if (this.recorded) return Promise.resolve();
    this.recorded = true;
    return Storage.recordRun(this.run);
  }

  private playAgain(): void {
    if (this.busy) return; // don't record/navigate while a continue is resolving
    Sfx.unlock();
    this.finalizeAndGo(SCENES.GAME);
  }

  private toMenu(): void {
    if (this.busy) return;
    this.finalizeAndGo(SCENES.MENU);
  }

  /** Record the run, then navigate — and still navigate even if recording fails. */
  private finalizeAndGo(scene: string): void {
    this.finalize()
      .catch(() => {})
      .then(() => this.go(scene));
  }

  private go(scene: string): void {
    this.cameras.main.fadeOut(200, 7, 11, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(scene);
    });
  }

  // --- UI helpers -------------------------------------------------------------

  private center(
    y: number,
    str: string,
    size: number,
    color: string,
    weight: "bold" | "normal" = "bold"
  ): Phaser.GameObjects.Text {
    return this.add
      .text(GAME.WIDTH / 2, y, str, {
        fontFamily: UI.FONT,
        fontSize: `${size}px`,
        color,
        fontStyle: weight,
      })
      .setOrigin(0.5)
      .setResolution(2);
  }

  private makeButton(
    y: number,
    label: string,
    onClick: () => void,
    opts: { w?: number; fontSize?: number; filled?: boolean } = {}
  ): { setText: (s: string) => void } {
    const w = opts.w ?? 196;
    const h = 54;
    const fontSize = opts.fontSize ?? 24;
    const filled = opts.filled ?? true;
    const accent = Phaser.Display.Color.HexStringToColor(UI.ACCENT).color;
    const x = GAME.WIDTH / 2;
    const c = this.add.container(x, y);

    let txt: Phaser.GameObjects.Text;
    if (filled) {
      const bg = this.add.image(0, 0, TEX.pad).setDisplaySize(w, h).setTint(accent);
      txt = this.add
        .text(0, 0, label, { fontFamily: UI.FONT, fontSize: `${fontSize}px`, color: "#07221f", fontStyle: "bold" })
        .setOrigin(0.5)
        .setResolution(3);
      c.add([bg, txt]);
      c.on("pointerover", () => bg.setTint(0xffffff));
      c.on("pointerout", () => bg.setTint(accent));
      this.tweens.add({ targets: c, scale: { from: 1, to: 1.04 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    } else {
      const bg = this.add.rectangle(0, 0, w, h, 0x16233d, 1).setStrokeStyle(2, accent, 1);
      txt = this.add
        .text(0, 0, label, { fontFamily: UI.FONT, fontSize: `${fontSize}px`, color: UI.ACCENT, fontStyle: "bold" })
        .setOrigin(0.5)
        .setResolution(2);
      c.add([bg, txt]);
    }
    c.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    c.on("pointerup", onClick);
    return { setText: (s: string) => txt.setText(s) };
  }

  private linkButton(y: number, label: string, onClick: () => void): void {
    const t = this.add
      .text(GAME.WIDTH / 2, y, label, {
        fontFamily: UI.FONT,
        fontSize: "18px",
        color: UI.TEXT_DIM,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });
    t.on("pointerover", () => t.setColor(UI.ACCENT));
    t.on("pointerout", () => t.setColor(UI.TEXT_DIM));
    t.on("pointerup", onClick);
  }
}
