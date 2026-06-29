import Phaser from "phaser";
import {
  ALL_SYMBOLS,
  COLORS,
  GAME,
  SCENES,
  TEX,
  UI,
} from "../config/constants";
import { createBackground } from "../ui/Background";
import { showBanner } from "../ui/Banner";
import { openSettings } from "../ui/SettingsPanel";
import { openTutorial } from "../ui/TutorialPanel";
import { createButton, createLinkButton, createText } from "../ui/widgets";
import { Monetization } from "../systems/Monetization";
import { Sfx } from "../systems/Sfx";
import { Storage } from "../systems/Storage";

/** Title screen: branding, the four symbols, how-to, Play, settings + tutorial. */
export class MenuScene extends Phaser.Scene {
  private bestText!: Phaser.GameObjects.Text;
  private overlayOpen = false;
  private menuBanner?: Phaser.GameObjects.Container;

  constructor() {
    super(SCENES.MENU);
  }

  create(): void {
    createBackground(this);
    this.cameras.main.fadeIn(280, 7, 11, 26);
    const H = GAME.HEIGHT; // dynamic — lay the menu out by fraction so it fills

    // Any interaction unlocks the audio context.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => Sfx.unlock());

    // Title.
    const title = createText(this, GAME.WIDTH / 2, H * 0.2, "QUADSHOT", 58, UI.TEXT)
      .setResolution(3)
      .setShadow(0, 0, UI.ACCENT, 24, true, true);
    this.fitWidth(title, GAME.WIDTH - 56);

    createText(this, GAME.WIDTH / 2, H * 0.252, "REFLEX ARCADE", 16, UI.ACCENT).setAlpha(0.9);

    // The four symbols, gently floating.
    const spread = 84;
    const symY = H * 0.36;
    const startX = GAME.WIDTH / 2 - (spread * (ALL_SYMBOLS.length - 1)) / 2;
    ALL_SYMBOLS.forEach((shape, i) => {
      const icon = this.add
        .image(startX + i * spread, symY, TEX.shape(shape))
        .setDisplaySize(52, 52)
        .setTint(COLORS[shape]);
      this.tweens.add({
        targets: icon,
        y: symY - 8,
        duration: 1200 + i * 140,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    });

    // How-to.
    const how = [
      "Slide the rack — tap a pad to fire.",
      "Destroy the matching symbols as they fall.",
      "Desktop:  ← →  move   •   1–4  fire",
    ];
    how.forEach((line, i) => {
      const t = createText(this, GAME.WIDTH / 2, H * 0.49 + i * 26, line, 15, UI.TEXT_DIM, 0.5, 0.5, "normal");
      this.fitWidth(t, GAME.WIDTH - 40);
    });

    // Best score.
    this.bestText = createText(this, GAME.WIDTH / 2, H * 0.625, "BEST  0", 18, UI.TEXT);
    this.refreshBest();

    // Play button.
    createButton(this, GAME.WIDTH / 2, H * 0.74, "PLAY", () => this.startGame(), {
      w: 168,
      h: 52,
      fontSize: 24,
    });

    // How-to-play link.
    createLinkButton(this, GAME.WIDTH / 2, H * 0.83, "HOW TO PLAY", () =>
      this.openTutorialOverlay(false)
    );

    // Settings gear (top-right corner).
    createLinkButton(this, GAME.WIDTH - 22, 22, "⚙", () => this.openSettingsOverlay(), 24);

    // Bottom ad banner (placeholder; hidden once ads are removed).
    this.menuBanner = showBanner(this);

    // Allow Enter / Space to start.
    this.input.keyboard?.once("keydown-ENTER", () => this.startGame());
    this.input.keyboard?.once("keydown-SPACE", () => this.startGame());

    // First run: show the tutorial automatically.
    void Storage.getTutorialSeen().then((seen) => {
      if (!seen) this.openTutorialOverlay(true);
    });
  }

  private refreshBest(): void {
    void Storage.getBestScore().then((best) =>
      this.bestText.setText(`BEST  ${best.toLocaleString()}`)
    );
  }

  private openSettingsOverlay(): void {
    if (this.overlayOpen) return;
    this.overlayOpen = true;
    Sfx.unlock();
    openSettings(this, () => {
      this.overlayOpen = false;
      this.refreshBest(); // reset-progress may have cleared it
      if (Monetization.isRemoved()) {
        this.menuBanner?.destroy();
        this.menuBanner = undefined;
      }
    });
  }

  private openTutorialOverlay(firstRun: boolean): void {
    if (this.overlayOpen) return;
    this.overlayOpen = true;
    openTutorial(this, () => {
      this.overlayOpen = false;
      if (firstRun) void Storage.setTutorialSeen();
    });
  }

  /** Shrink a text object uniformly if it is wider than `max` (keeps it on-screen). */
  private fitWidth(t: Phaser.GameObjects.Text, max: number): void {
    if (t.width > max) t.setScale(max / t.width);
  }

  private startGame(): void {
    if (this.overlayOpen) return; // don't start behind a modal
    Sfx.unlock();
    this.cameras.main.fadeOut(220, 7, 11, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.GAME);
    });
  }
}
