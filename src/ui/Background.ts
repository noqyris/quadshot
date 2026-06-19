import Phaser from "phaser";
import { COLORS, GAME, Sym, TEX } from "../config/constants";

/**
 * Draws the shared dark-neon backdrop: a subtle grid plus a few slowly
 * breathing ambient glows. Lives at the lowest depth so everything renders
 * on top. Safe to call once per scene in `create()`.
 */
export function createBackground(scene: Phaser.Scene): void {
  // Faint grid.
  const grid = scene.add.graphics().setDepth(-100);
  grid.lineStyle(1, 0x1b2a4a, 0.6);
  const step = 40;
  for (let x = 0; x <= GAME.WIDTH; x += step) {
    grid.lineBetween(x, 0, x, GAME.HEIGHT);
  }
  for (let y = 0; y <= GAME.HEIGHT; y += step) {
    grid.lineBetween(0, y, GAME.WIDTH, y);
  }

  // Ambient glows in the symbol palette.
  const glows: Array<{ x: number; y: number; color: number; scale: number }> = [
    { x: GAME.WIDTH * 0.2, y: GAME.HEIGHT * 0.18, color: COLORS[Sym.TRIANGLE], scale: 2.6 },
    { x: GAME.WIDTH * 0.82, y: GAME.HEIGHT * 0.3, color: COLORS[Sym.SQUARE], scale: 2.2 },
    { x: GAME.WIDTH * 0.7, y: GAME.HEIGHT * 0.72, color: COLORS[Sym.CROSS], scale: 2.8 },
    { x: GAME.WIDTH * 0.25, y: GAME.HEIGHT * 0.62, color: COLORS[Sym.CIRCLE], scale: 2.4 },
  ];

  glows.forEach((cfg, i) => {
    const glow = scene.add
      .image(cfg.x, cfg.y, TEX.glow)
      .setTint(cfg.color)
      .setAlpha(0.16)
      .setScale(cfg.scale)
      .setDepth(-99)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.08, to: 0.2 },
      scale: { from: cfg.scale * 0.9, to: cfg.scale * 1.1 },
      duration: 3200 + i * 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  });
}
