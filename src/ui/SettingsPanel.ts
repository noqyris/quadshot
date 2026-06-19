import Phaser from "phaser";
import { GAME, MONETIZATION, UI } from "../config/constants";
import { Haptics } from "../systems/Haptics";
import { Monetization } from "../systems/Monetization";
import { Sfx } from "../systems/Sfx";
import { Storage } from "../systems/Storage";

/**
 * Modal settings overlay: sound + haptics toggles and a (confirm-guarded) reset.
 * Self-contained — reads/writes Storage and applies changes live. Calls
 * `onClose` after tearing itself down.
 */
export function openSettings(scene: Phaser.Scene, onClose: () => void): void {
  const cx = GAME.WIDTH / 2;
  const cy = GAME.HEIGHT / 2;
  const c = scene.add.container(0, 0).setDepth(200);

  const dim = scene.add
    .rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, 0x05070f, 0.82)
    .setInteractive(); // swallow taps behind the panel
  const panel = scene.add
    .rectangle(cx, cy, 330, 446, 0x101a30, 0.98)
    .setStrokeStyle(2, 0x2b3a5c, 1);
  c.add([dim, panel]);

  c.add(label(scene, cx, cy - 186, "SETTINGS", 26, UI.TEXT, 0.5));

  c.add(toggleRow(scene, cx, cy - 128, "SOUND", !Sfx.isMuted(), (on) => {
    Sfx.unlock();
    Sfx.setMuted(!on);
    void Storage.setMuted(!on);
  }));
  c.add(toggleRow(scene, cx, cy - 78, "HAPTICS", Haptics.isEnabled(), (on) => {
    Haptics.setEnabled(on);
    void Storage.setHaptics(on);
    if (on) Haptics.fire();
  }));

  // Monetization: remove-ads purchase + restore (hidden if ads are disabled).
  if (MONETIZATION.ENABLED) {
    if (Monetization.isRemoved()) {
      c.add(label(scene, cx, cy - 16, "✓ ADS REMOVED — THANK YOU", 15, UI.ACCENT, 0.5));
    } else {
      const buy = label(
        scene,
        cx,
        cy - 22,
        `REMOVE ADS — ${MONETIZATION.REMOVE_ADS_PRICE}`,
        16,
        UI.ACCENT,
        0.5
      ).setInteractive({ useHandCursor: true });
      buy.on("pointerup", () => {
        buy.setText("…");
        void Monetization.purchaseRemoveAds().then((ok) =>
          buy.setText(ok ? "✓ ADS REMOVED — THANK YOU" : `REMOVE ADS — ${MONETIZATION.REMOVE_ADS_PRICE}`)
        );
      });
      c.add(buy);
      const restore = label(scene, cx, cy + 8, "Restore purchases", 12, UI.TEXT_DIM, 0.5).setInteractive({
        useHandCursor: true,
      });
      restore.on("pointerup", () => {
        restore.setText("…");
        void Monetization.restore().then((owned) => {
          if (owned) buy.setText("✓ ADS REMOVED — THANK YOU");
          restore.setText(owned ? "Restored" : "Nothing to restore");
        });
      });
      c.add(restore);
    }
  }

  // Reset progress — two-tap confirm.
  const reset = label(scene, cx, cy + 70, "RESET PROGRESS", 16, UI.DANGER, 0.5).setInteractive({
    useHandCursor: true,
  });
  let armed = false;
  reset.on("pointerup", () => {
    if (!armed) {
      armed = true;
      reset.setText("TAP AGAIN TO CONFIRM");
      return;
    }
    void Storage.resetProgress().then(() => reset.setText("✓ PROGRESS RESET"));
    armed = false;
  });
  c.add(reset);

  c.add(pillButton(scene, cx, cy + 166, "CLOSE", () => {
    c.destroy();
    onClose();
  }));
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

function toggleRow(
  scene: Phaser.Scene,
  cx: number,
  y: number,
  name: string,
  initial: boolean,
  onChange: (on: boolean) => void
): Phaser.GameObjects.Container {
  const row = scene.add.container(0, 0);
  const left = label(scene, cx - 128, y, name, 17, UI.TEXT, 0);
  let on = initial;
  const value = label(scene, cx + 128, y, "", 17, UI.ACCENT, 1).setInteractive({
    useHandCursor: true,
  });
  const render = () => {
    value.setText(on ? "ON" : "OFF");
    value.setColor(on ? UI.ACCENT : UI.TEXT_DIM);
  };
  render();
  value.on("pointerup", () => {
    on = !on;
    render();
    onChange(on);
  });
  row.add([left, value]);
  return row;
}

function pillButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onClick: () => void
): Phaser.GameObjects.Container {
  const w = 150;
  const h = 46;
  const c = scene.add.container(x, y);
  const bg = scene.add
    .rectangle(0, 0, w, h, 0x16233d, 1)
    .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(UI.ACCENT).color, 1);
  const t = label(scene, 0, 0, text, 18, UI.ACCENT, 0.5);
  c.add([bg, t]);
  c.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  });
  c.on("pointerup", onClick);
  return c;
}
