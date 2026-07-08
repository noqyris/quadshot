import Phaser from "phaser";
import { GAME, HIGH_SCORE_COUNT, SCENES, UI } from "../config/constants";
import { createBackground } from "../ui/Background";
import { showBanner } from "../ui/Banner";
import { createButton, createLinkButton, createText } from "../ui/widgets";
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
    const { score, bestCombo, phase } = this.run;
    const isNewBest = score > storedBest && score > 0;
    const reveals: Phaser.GameObjects.Text[] = [];

    const title = this.center(H * 0.155, "GAME OVER", 50, UI.TEXT);
    title.setShadow(0, 0, UI.DANGER, 26, true, true);
    if (title.width > GAME.WIDTH - 56) title.setScale((GAME.WIDTH - 56) / title.width);
    reveals.push(title);

    reveals.push(this.center(H * 0.235, "SCORE", 14, UI.TEXT_DIM));
    const scoreText = this.center(H * 0.278, "0", 46, UI.TEXT)
      .setResolution(3)
      .setShadow(0, 0, UI.ACCENT, 16, true, true);
    reveals.push(scoreText);
    const bestLabel = this.center(
      H * 0.342,
      isNewBest ? "★ NEW BEST ★" : `BEST  ${Math.max(storedBest, score).toLocaleString()}`,
      18,
      isNewBest ? UI.ACCENT : UI.TEXT_DIM
    );
    reveals.push(bestLabel);
    const stats = this.center(
      H * 0.388,
      `PHASE ${phase}   •   BEST STREAK ${bestCombo}`,
      13,
      UI.TEXT_DIM
    );
    if (stats.width > GAME.WIDTH - 32) stats.setScale((GAME.WIDTH - 32) / stats.width);
    reveals.push(stats);

    // High-score table (this run merged in for display; persisted on decline).
    // When the continue CTA is shown there's an extra button in the stack, so we
    // show a compact table to avoid colliding with it on short screens (H≈720).
    reveals.push(this.center(H * 0.44, "HIGH SCORES", 13, UI.TEXT_DIM));
    const rowsToShow = canContinue ? 3 : HIGH_SCORE_COUNT;
    const display = [...storedScores, score].sort((a, b) => b - a).slice(0, rowsToShow);
    const RANK = [0xfbbf24, 0xcbd5e1, 0xd8843b]; // gold / silver / bronze
    let highlighted = false;
    display.forEach((s, i) => {
      const isThisRun = !highlighted && s === score;
      if (isThisRun) highlighted = true;
      const row = this.center(
        H * 0.47 + i * 22,
        `${i + 1}.   ${s.toLocaleString()}`,
        16,
        isThisRun ? UI.ACCENT : UI.TEXT,
        isThisRun ? "bold" : "normal"
      );
      if (!isThisRun && i < RANK.length) row.setTint(RANK[i]); // medal colours for the podium
      reveals.push(row);
    });

    // Choices — continue (rewarded) is the encouraged CTA when eligible.
    const shareData = { score, best: Math.max(storedBest, score), phase, isNewBest };
    const cx = GAME.WIDTH / 2;
    const buttons: Phaser.GameObjects.Container[] = [];
    let menuLink: Phaser.GameObjects.Text;
    if (canContinue) {
      buttons.push(
        createButton(this, cx, H * 0.61, "WATCH AD & CONTINUE", () => this.continueRun(), {
          w: 264,
          fontSize: 18,
          filled: true,
        }).container,
        createButton(this, cx, H * 0.69, "SHARE  ↗", () => this.share(shareData), { filled: true }).container,
        createButton(this, cx, H * 0.77, "PLAY AGAIN", () => this.playAgain(), { filled: false }).container
      );
      menuLink = createLinkButton(this, cx, H * 0.85, "MENU", () => this.toMenu(), 18);
    } else {
      buttons.push(
        createButton(this, cx, H * 0.655, "SHARE  ↗", () => this.share(shareData), { filled: true }).container,
        createButton(this, cx, H * 0.735, "PLAY AGAIN", () => this.playAgain(), { filled: false }).container
      );
      menuLink = createLinkButton(this, cx, H * 0.815, "MENU", () => this.toMenu(), 18);
    }

    showBanner(this); // bottom ad banner (placeholder) when ads are active

    this.input.keyboard?.once("keydown-ENTER", () => this.playAgain());
    this.input.keyboard?.once("keydown-SPACE", () => this.playAgain());

    // --- Entrance: cascade the text in, count the score up, then float the choices in.
    reveals.forEach((t, i) => {
      const y = t.y;
      const alpha = t.alpha; // table rows / labels keep their intended alpha
      t.setAlpha(0);
      t.y = y + 12;
      this.tweens.add({ targets: t, y, alpha, delay: 80 + i * 70, duration: 320, ease: "Quad.out" });
    });
    const choices: Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text> = [...buttons, menuLink];
    choices.forEach((c, i) => {
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, delay: 80 + (reveals.length + i) * 70, duration: 300, ease: "Quad.out" });
    });

    // Animated score count-up after its label settles.
    if (score > 0) {
      this.tweens.addCounter({
        from: 0,
        to: score,
        delay: 260,
        duration: 900,
        ease: "Quad.out",
        onUpdate: (tw) => scoreText.setText(Math.round(tw.getValue() ?? score).toLocaleString()),
        onComplete: () => {
          scoreText.setText(score.toLocaleString());
          this.tweens.add({ targets: scoreText, scale: { from: 1.12, to: 1 }, duration: 220, ease: "Back.out" });
          if (isNewBest) {
            Sfx.match(6);
            this.tweens.add({ targets: bestLabel, scale: { from: 1, to: 1.16 }, duration: 220, yoyo: true, ease: "Sine.inOut" });
          }
        },
      });
    } else {
      scoreText.setText("0");
    }
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

  /**
   * Record the run, maybe show an interstitial, then navigate — and still
   * navigate even if recording or the ad fails.
   *
   * `maybeInterstitial()` resolves only once the ad is DISMISSED, so the scene
   * transition never starts behind a full-screen ad. `busy` blocks re-taps for
   * the whole window (a cold interstitial load can take seconds).
   */
  private finalizeAndGo(scene: string): void {
    this.busy = true;
    this.finalize()
      .catch(() => {})
      .then(() => Monetization.maybeInterstitial())
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
    color: string = UI.TEXT,
    weight: "bold" | "normal" = "bold"
  ): Phaser.GameObjects.Text {
    return createText(this, GAME.WIDTH / 2, y, str, size, color, 0.5, 0.5, weight);
  }
}
