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
import { ACCENT_NUM, createButton, createLinkButton, createText } from "../ui/widgets";
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
    this.cameras.main.fadeIn(320, 7, 11, 26);
    const H = GAME.HEIGHT; // dynamic — lay the menu out by fraction so it fills
    const cx = GAME.WIDTH / 2;

    // Any interaction unlocks the audio context.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => Sfx.unlock());

    // Soft cyan bloom behind the title for a glowing logo plate.
    const bloom = this.add
      .image(cx, H * 0.205, TEX.bloom)
      .setTint(ACCENT_NUM)
      .setAlpha(0)
      .setScale(2.9, 2.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-50);
    this.tweens.add({ targets: bloom, alpha: 0.16, duration: 600, ease: "Quad.out" });
    this.tweens.add({
      targets: bloom,
      alpha: { from: 0.13, to: 0.2 },
      scaleX: { from: 2.9, to: 3.15 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      delay: 600,
      ease: "Sine.inOut",
    });

    // Title.
    const title = createText(this, cx, H * 0.2, "QUADSHOT", 58, UI.TEXT)
      .setResolution(3)
      .setShadow(0, 0, UI.ACCENT, 38, true, true);
    this.fitWidth(title, GAME.WIDTH - 56);
    const subtitle = createText(this, cx, H * 0.252, "REFLEX ARCADE", 16, UI.ACCENT)
      .setAlpha(0.9)
      .setLetterSpacing(3);

    // The four symbols, gently floating.
    const spread = 84;
    const symY = H * 0.36;
    const startX = cx - (spread * (ALL_SYMBOLS.length - 1)) / 2;
    const symbols = ALL_SYMBOLS.map((shape, i) => {
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
      return icon;
    });

    // How-to.
    const how = [
      "Slide the rack — tap a pad to fire.",
      "Destroy the matching symbols as they fall.",
      "Desktop:  ← →  move   •   1–4  fire",
    ];
    const howLines = how.map((line, i) => {
      const t = createText(this, cx, H * 0.49 + i * 26, line, 15, UI.TEXT_DIM, 0.5, 0.5, "normal");
      this.fitWidth(t, GAME.WIDTH - 40);
      return t;
    });

    // Best score.
    this.bestText = createText(this, cx, H * 0.625, "BEST  0", 18, UI.TEXT);
    this.refreshBest();

    // Play button.
    const play = createButton(this, cx, H * 0.74, "PLAY", () => this.startGame(), {
      w: 168,
      h: 52,
      fontSize: 24,
    }).container;

    // How-to-play link.
    const howToPlay = createLinkButton(this, cx, H * 0.83, "HOW TO PLAY", () =>
      this.openTutorialOverlay(false)
    );

    // Settings gear (top-right corner).
    createLinkButton(this, GAME.WIDTH - 22, 22, "⚙", () => this.openSettingsOverlay(), 24);

    // Bottom ad banner (placeholder; hidden once ads are removed).
    this.menuBanner = showBanner(this);

    // Staggered entrance — each element rises + fades in for a premium reveal.
    const reveal = (
      obj: Phaser.GameObjects.Text | Phaser.GameObjects.Container,
      toAlpha: number,
      delay: number,
      rise = 10
    ) => {
      const y = obj.y;
      obj.setAlpha(0);
      obj.y = y + rise;
      this.tweens.add({ targets: obj, y, alpha: toAlpha, delay, duration: 360, ease: "Quad.out" });
    };
    reveal(title, 1, 80, 14);
    reveal(subtitle, 0.9, 160);
    symbols.forEach((s, i) => {
      s.setAlpha(0);
      const base = s.scaleX;
      s.setScale(base * 0.6);
      this.tweens.add({ targets: s, alpha: 1, scaleX: base, scaleY: base, delay: 240 + i * 80, duration: 380, ease: "Back.out" });
    });
    howLines.forEach((t, i) => reveal(t, 1, 560 + i * 80, 8));
    reveal(this.bestText, 1, 820);
    reveal(play, 1, 900, 14);
    reveal(howToPlay, 1, 980);

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
