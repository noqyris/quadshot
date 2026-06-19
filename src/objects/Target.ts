import Phaser from "phaser";
import { TARGET, TEX, Sym } from "../config/constants";

/**
 * A falling target.
 *
 * `shape` and `color` are stored independently (v1 locks them 1:1, but the
 * match engine only reads the fields it needs). Movement and collision are
 * handled manually (see GameScene) for fully predictable behaviour — no physics
 * body, so type-locked "pass-through" is just "only test the pairs that match".
 *
 * Pooled via a Phaser Group: `spawn()` revives, `deactivate()` parks for reuse.
 */
export class Target extends Phaser.GameObjects.Image {
  shape: Sym = Sym.TRIANGLE;
  color = 0xffffff;
  speed = 0; // px/sec downward
  /** Collision radius in world units. */
  hitRadius = TARGET.SIZE * 0.45;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TEX.shape(Sym.TRIANGLE));
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, shape: Sym, color: number, speed: number): void {
    this.shape = shape;
    this.color = color;
    this.speed = speed;
    this.setTexture(TEX.shape(shape));
    this.setDisplaySize(TARGET.SIZE, TARGET.SIZE);
    this.setTint(color);
    this.setPosition(x, -TARGET.SIZE * 0.6);
    this.setActive(true).setVisible(true);
  }

  /** Advance one frame; `dt` is in seconds. */
  advance(dt: number): void {
    this.y += this.speed * dt;
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
    this.clearTint();
  }
}
