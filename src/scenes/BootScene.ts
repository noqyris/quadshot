import Phaser from "phaser";
import { ALL_SYMBOLS, SCENES, Sym, TEX } from "../config/constants";
import { Haptics } from "../systems/Haptics";
import { Monetization } from "../systems/Monetization";
import { Sfx } from "../systems/Sfx";
import { Storage } from "../systems/Storage";

/** Supersample factor — textures are drawn large and displayed small for crisp edges. */
const SS = 4;

/**
 * Generates every texture from Graphics (no external art), restores the saved
 * mute setting, then hands off to the Menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create(): void {
    ALL_SYMBOLS.forEach((s) => this.makeShapeTexture(s));
    this.makePadTexture();
    this.makeRoundPadTexture();
    this.makePadRingTexture();
    this.makeParticleTexture();
    this.makeRingTexture();
    this.makeGlowTexture();

    // Restore persisted settings + monetization state before the menu.
    void Promise.all([
      Storage.getMuted(),
      Storage.getHaptics(),
      Monetization.init(),
    ])
      .then(([muted, haptics]) => {
        Sfx.setMuted(muted);
        Haptics.setEnabled(haptics);
        this.scene.start(SCENES.MENU);
      })
      // Never leave the player stuck on a black boot screen if any restore
      // call ever rejects — start the menu with defaults regardless.
      .catch(() => this.scene.start(SCENES.MENU));
  }

  // --- Controller symbols: hollow neon outlines (white; tinted at runtime) ----

  private makeShapeTexture(shape: Sym): void {
    const size = 40 * SS;
    const c = size / 2;
    const r = size * 0.3;
    const baseW = 3.4 * SS; // core stroke width
    const g = this.add.graphics();

    // Draw the symbol outline at a given stroke width + alpha.
    const outline = (width: number, alpha: number) => {
      g.lineStyle(width, 0xffffff, alpha);
      switch (shape) {
        case Sym.TRIANGLE:
          g.beginPath();
          g.moveTo(c, c - r * 1.04);
          g.lineTo(c + r, c + r * 0.78);
          g.lineTo(c - r, c + r * 0.78);
          g.closePath();
          g.strokePath();
          break;
        case Sym.CIRCLE:
          g.strokeCircle(c, c, r * 0.92);
          break;
        case Sym.CROSS: {
          const a = r * 0.82;
          g.lineBetween(c - a, c - a, c + a, c + a);
          g.lineBetween(c - a, c + a, c + a, c - a);
          break;
        }
        case Sym.SQUARE: {
          const s = r * 1.5;
          g.strokeRoundedRect(c - s / 2, c - s / 2, s, s, s * 0.16);
          break;
        }
      }
    };

    // Outer glow (fat, faint strokes) then the bright core outline.
    for (let i = 3; i >= 1; i--) outline(baseW + i * 7, 0.05 * i);
    outline(baseW, 1);

    g.generateTexture(TEX.shape(shape), size, size);
    g.destroy();
  }

  // --- Rounded neon pad button (menu / overlay buttons) ----------------------

  private makePadTexture(): void {
    const w = 168 * 2;
    const h = 108 * 2;
    const radius = 26 * 2;
    const g = this.add.graphics();

    // Glow halo.
    for (let i = 4; i >= 1; i--) {
      const inset = 10 - i * 2;
      g.fillStyle(0xffffff, 0.05 * i);
      g.fillRoundedRect(
        inset,
        inset,
        w - inset * 2,
        h - inset * 2,
        radius
      );
    }
    // Body.
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(14, 14, w - 28, h - 28, radius * 0.8);
    // Bright rim.
    g.lineStyle(6, 0xffffff, 1);
    g.strokeRoundedRect(14, 14, w - 28, h - 28, radius * 0.8);

    g.generateTexture(TEX.pad, w, h);
    g.destroy();
  }

  /**
   * Dark, glossy round controller-button body (used untinted). The bright neon
   * edge + colour comes from a separate ring texture so each button reads as a
   * dark controller key with a coloured symbol — like a real face button.
   */
  private makeRoundPadTexture(): void {
    const size = 184;
    const c = size / 2;
    const r = 64;
    const g = this.add.graphics();

    // Dark body.
    g.fillStyle(0x141a2e, 1);
    g.fillCircle(c, c, r);
    // Lower belly shade (kept inside the core).
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(c, c + r * 0.32, r * 0.55);
    // Soft top gloss.
    g.fillStyle(0xffffff, 0.08);
    g.fillEllipse(c, c - r * 0.42, r * 1.0, r * 0.5);
    // Faint inner rim for definition.
    g.lineStyle(3, 0x33415e, 0.6);
    g.strokeCircle(c, c, r);

    g.generateTexture(TEX.padRound, size, size);
    g.destroy();
  }

  /** White neon ring + outer glow; tinted per symbol → coloured pad rim. */
  private makePadRingTexture(): void {
    const size = 184;
    const c = size / 2;
    const r = 64;
    const g = this.add.graphics();

    // Outer glow.
    for (let i = 6; i >= 1; i--) {
      g.lineStyle(3 + i * 5, 0xffffff, 0.05 * i);
      g.strokeCircle(c, c, r);
    }
    // Bright rim.
    g.lineStyle(7, 0xffffff, 1);
    g.strokeCircle(c, c, r);

    g.generateTexture(TEX.padRing, size, size);
    g.destroy();
  }

  // --- Particles / rings / ambient glow --------------------------------------

  private makeParticleTexture(): void {
    const size = 32;
    const g = this.add.graphics();
    for (let i = 6; i >= 1; i--) {
      g.fillStyle(0xffffff, i >= 5 ? 1 : 0.12 * i);
      g.fillCircle(size / 2, size / 2, (size / 2) * (i / 6));
    }
    g.generateTexture(TEX.particle, size, size);
    g.destroy();
  }

  private makeRingTexture(): void {
    const size = 96;
    const g = this.add.graphics();
    g.lineStyle(7, 0xffffff, 1);
    g.strokeCircle(size / 2, size / 2, size / 2 - 6);
    g.generateTexture(TEX.ring, size, size);
    g.destroy();
  }

  private makeGlowTexture(): void {
    const size = 256;
    const g = this.add.graphics();
    for (let i = 40; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.012);
      g.fillCircle(size / 2, size / 2, (size / 2) * (i / 40));
    }
    g.generateTexture(TEX.glow, size, size);
    g.destroy();
  }
}
