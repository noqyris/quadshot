import Phaser from "phaser";
import { GAME, MONETIZATION, UI } from "../config/constants";
import { Monetization } from "../systems/Monetization";

/**
 * Bottom ad banner — shown on non-gameplay screens (menu / game over) only, so
 * it never covers the launcher. This is a PLACEHOLDER; in production a native
 * AdMob banner renders in this strip (same position). Includes an inline
 * "Remove $0.99" shortcut. No-op once ads are removed / disabled.
 */
export function showBanner(scene: Phaser.Scene): Phaser.GameObjects.Container | undefined {
  if (!Monetization.adsActive()) return undefined;

  const W = GAME.WIDTH;
  const h = 54;
  const cy = GAME.HEIGHT - h / 2;
  const c = scene.add.container(0, 0).setDepth(140);

  const bg = scene.add
    .rectangle(W / 2, cy, W, h, 0x0c1426, 1)
    .setStrokeStyle(1, 0x223052, 1);
  const tag = label(scene, 14, cy, "AD", 10, UI.TEXT_DIM, 0);
  const placeholder = label(scene, W / 2, cy, "your ad here", 13, "#4b5a7a", 0.5);
  const remove = label(
    scene,
    W - 12,
    cy,
    `Remove ${MONETIZATION.REMOVE_ADS_PRICE}`,
    12,
    UI.ACCENT,
    1
  ).setInteractive({ useHandCursor: true });

  remove.on("pointerup", () => {
    remove.setText("…");
    void Monetization.purchaseRemoveAds().then((ok) => {
      if (!c.scene) return; // scene torn down while the purchase was in flight
      if (ok) c.destroy();
      else remove.setText(`Remove ${MONETIZATION.REMOVE_ADS_PRICE}`);
    });
  });

  c.add([bg, tag, placeholder, remove]);
  return c;
}

function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: string,
  originX: number
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, {
      fontFamily: UI.FONT,
      fontSize: `${size}px`,
      color,
      fontStyle: "bold",
    })
    .setOrigin(originX, 0.5)
    .setResolution(2);
}
