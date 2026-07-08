import Phaser from "phaser";
import { GAME, MONETIZATION, UI } from "../config/constants";
import { Monetization } from "../systems/Monetization";
import { createText } from "./widgets";

/**
 * Bottom ad banner — a DEV-ONLY Phaser placeholder, off by default.
 *
 * No native banner ships. A real AdMob banner is pinned to the bottom of the
 * *window*, outside the Phaser canvas, in the same strip the launcher pads live
 * in (LAUNCHER.Y = H-74, hit radius 44) — and nothing inside Phaser can remove
 * it once GameScene starts. That whole failure mode is designed out via
 * MONETIZATION.SHOW_BANNER rather than guarded. Rewarded + interstitial carry
 * the ads instead.
 */
export function showBanner(scene: Phaser.Scene): Phaser.GameObjects.Container | undefined {
  if (!MONETIZATION.SHOW_BANNER || !Monetization.adsActive()) return undefined;

  const W = GAME.WIDTH;
  const h = 54;
  const cy = GAME.HEIGHT - h / 2;
  const c = scene.add.container(0, 0).setDepth(140);

  const bg = scene.add
    .rectangle(W / 2, cy, W, h, 0x0c1426, 1)
    .setStrokeStyle(1, 0x223052, 1);
  const tag = createText(scene, 14, cy, "AD", 10, UI.TEXT_DIM, 0);
  const placeholder = createText(scene, W / 2, cy, "your ad here", 13, "#4b5a7a", 0.5);
  c.add([bg, tag, placeholder]);
  return c;
}
