import Phaser from "phaser";
import { PROJECTILE, TEX, Sym } from "../config/constants";

/**
 * A symbol fired straight up from a pad.
 *
 * Carries its `shape` (and colour for visuals). It interacts only with targets
 * it can destroy — see MatchRules — and passes through everything else, so a
 * projectile is consumed only when it actually kills, otherwise it flies off
 * the top and is recycled. Pooled via a Phaser Group.
 */
export class Projectile extends Phaser.GameObjects.Image {
  shape: Sym = Sym.TRIANGLE;
  color = 0xffffff;
  /** Collision radius in world units. */
  hitRadius = PROJECTILE.SIZE * 0.5;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TEX.shape(Sym.TRIANGLE));
    this.setActive(false).setVisible(false);
  }

  fire(x: number, y: number, shape: Sym, color: number): void {
    this.shape = shape;
    this.color = color;
    this.setTexture(TEX.shape(shape));
    this.setDisplaySize(PROJECTILE.SIZE, PROJECTILE.SIZE);
    this.setTint(color);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
  }

  /** Advance one frame; `dt` is in seconds. */
  advance(dt: number): void {
    this.y -= PROJECTILE.SPEED * dt;
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
    this.clearTint();
  }
}
