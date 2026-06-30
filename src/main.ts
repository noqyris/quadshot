import Phaser from "phaser";
import { DEV, GAME, LAYOUT } from "./config/constants";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";

// Dev-only DOM error overlay: captures ANY uncaught error / promise rejection
// and shows it on-screen, independent of Phaser/WebGL — so a device-only bug is
// visible (and screenshot-able) even if the canvas freezes. Off in release.
if (DEV.ENABLED) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:rgba(130,10,20,.9);" +
    "color:#fff;font:11px/1.4 monospace;padding:8px;max-height:45%;overflow:auto;" +
    "white-space:pre-wrap;display:none";
  const append = (m: string) => {
    box.style.display = "block";
    box.textContent = `${box.textContent ?? ""}${m}\n`;
  };
  const ready = () => document.body && document.body.appendChild(box);
  if (document.body) ready();
  else window.addEventListener("DOMContentLoaded", ready);
  window.addEventListener("error", (e) =>
    append(`ERR: ${e.message}${e.filename ? ` @ ${e.filename.split("/").pop()}:${e.lineno}` : ""}`)
  );
  window.addEventListener("unhandledrejection", (e) =>
    append(`REJECT: ${(e.reason && (e.reason.message || e.reason)) ?? "unknown"}`)
  );
}

/**
 * Boot the game once the layout has SETTLED. iOS WebViews apply the safe-area
 * insets (env()) a beat after first layout, so the #game content box keeps
 * shrinking for a few frames. If we read its size too early, GAME.HEIGHT is
 * wrong and the FIT canvas overflows above/below the safe area (the HUD ends up
 * under the status bar / the pads under the home indicator). So we wait until
 * #game's height is stable before sizing the logical field.
 */
function createGame(): void {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: GAME.BG_HEX,
    width: GAME.WIDTH,
    height: GAME.HEIGHT,
    // Portrait field sized to the device aspect, so FIT fills the safe area.
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME.WIDTH,
      height: GAME.HEIGHT,
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: "high-performance",
    },
    // Targets/projectiles use manual movement + circle-overlap checks, so no
    // physics engine is needed (keeps "pass-through" trivial and deterministic).
    scene: [BootScene, MenuScene, GameScene, GameOverScene],
  };

  const game = new Phaser.Game(config);
  // Expose the game instance for debugging / automated smoke tests.
  window.game = game;

  if (DEV.ENABLED) {
    void import("./ui/ShareCard").then(({ buildShareCard }) => {
      window.__shareCard = (d) =>
        buildShareCard(d as Parameters<typeof buildShareCard>[0]).toDataURL("image/png");
    });
  }
}

(() => {
  const el = document.getElementById("game");
  let lastH = -1;
  let stable = 0;
  let frames = 0;
  const tick = () => {
    const w = (el?.clientWidth || window.innerWidth) || GAME.WIDTH;
    const h = (el?.clientHeight || window.innerHeight) || GAME.HEIGHT;
    if (h === lastH) stable++;
    else {
      stable = 0;
      lastH = h;
    }
    frames++;
    // Boot once the height holds steady (insets applied) or after a safety cap.
    if (stable >= 3 || frames > 90) {
      const aspect = h > 0 && w > 0 ? h / w : 800 / 480;
      GAME.HEIGHT = Math.round(
        Phaser.Math.Clamp(GAME.WIDTH * aspect, LAYOUT.MIN_HEIGHT, LAYOUT.MAX_HEIGHT)
      );
      createGame();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
