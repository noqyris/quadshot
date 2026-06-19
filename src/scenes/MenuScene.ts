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
    const title = this.add
      .text(GAME.WIDTH / 2, H * 0.2, "QUADSHOT", {
        fontFamily: UI.FONT,
        fontSize: "58px",
        color: UI.TEXT,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(3)
      .setShadow(0, 0, UI.ACCENT, 24, true, true);
    this.fitWidth(title, GAME.WIDTH - 56);

    this.add
      .text(GAME.WIDTH / 2, H * 0.252, "REFLEX ARCADE", {
        fontFamily: UI.FONT,
        fontSize: "16px",
        color: UI.ACCENT,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setAlpha(0.9);

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
      const t = this.add
        .text(GAME.WIDTH / 2, H * 0.49 + i * 26, line, {
          fontFamily: UI.FONT,
          fontSize: "15px",
          color: UI.TEXT_DIM,
        })
        .setOrigin(0.5)
        .setResolution(2);
      this.fitWidth(t, GAME.WIDTH - 40);
    });

    // Best score.
    this.bestText = this.add
      .text(GAME.WIDTH / 2, H * 0.625, "BEST  0", {
        fontFamily: UI.FONT,
        fontSize: "18px",
        color: UI.TEXT,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.refreshBest();

    // Play button.
    this.makeButton(GAME.WIDTH / 2, H * 0.74, "PLAY", () => this.startGame());

    // How-to-play link.
    this.linkButton(GAME.WIDTH / 2, H * 0.83, "HOW TO PLAY", () =>
      this.openTutorialOverlay(false)
    );

    // Settings gear (top-right corner).
    this.linkButton(GAME.WIDTH - 22, 22, "⚙", () => this.openSettingsOverlay(), 24);

    // Bottom ad banner (placeholder; hidden once ads are removed).
    this.menuBanner = showBanner(this);

    // Allow Enter / Space to start.
    this.input.keyboard?.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard?.on("keydown-SPACE", () => this.startGame());

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

  private linkButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    size = 16
  ): void {
    const t = this.add
      .text(x, y, label, {
        fontFamily: UI.FONT,
        fontSize: `${size}px`,
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

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const w = 168;
    const h = 52;
    const accent = Phaser.Display.Color.HexStringToColor(UI.ACCENT).color;
    // Bg + text live in a container so the breathing tween scales the container
    // (base scale 1) and never clobbers the image's setDisplaySize scaling.
    const c = this.add.container(x, y);
    const bg = this.add.image(0, 0, TEX.pad).setDisplaySize(w, h).setTint(accent);
    const txt = this.add
      .text(0, 0, label, {
        fontFamily: UI.FONT,
        fontSize: "24px",
        color: "#07221f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setResolution(3);
    c.add([bg, txt]);
    c.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });

    this.tweens.add({
      targets: c,
      scale: { from: 1, to: 1.04 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    c.on("pointerover", () => bg.setTint(0xffffff));
    c.on("pointerout", () => bg.setTint(accent));
    c.on("pointerup", onClick);
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
