import Phaser from "phaser";
import { TEX, UI } from "../config/constants";

/**
 * Shared UI widget factory — one place for the text + button styling that every
 * scene/overlay used to re-declare. Keeps the look consistent and removes the
 * five-plus near-identical `label()`/`txt()`/`makeButton()` helpers that had
 * drifted across the codebase.
 */

/** UI.ACCENT as a Phaser numeric colour (computed once, not per button). */
export const ACCENT_NUM = Phaser.Display.Color.HexStringToColor(UI.ACCENT).color;

/** A standard bold UI label. Defaults match the old per-file helpers exactly. */
export function createText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: string = UI.TEXT,
  originX = 0.5,
  originY = 0.5,
  weight: "bold" | "normal" = "bold"
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, {
      fontFamily: UI.FONT,
      fontSize: `${size}px`,
      color,
      fontStyle: weight,
    })
    .setOrigin(originX, originY)
    .setResolution(2);
}

/**
 * A tappable text link that brightens to the accent colour on hover. Returns the
 * Text so callers can reposition / restyle it.
 */
export function createLinkButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  size = 16
): Phaser.GameObjects.Text {
  const t = createText(scene, x, y, label, size, UI.TEXT_DIM).setInteractive({
    useHandCursor: true,
  });
  t.on("pointerover", () => t.setColor(UI.ACCENT));
  t.on("pointerout", () => t.setColor(UI.TEXT_DIM));
  t.on("pointerup", onClick);
  return t;
}

export interface ButtonOpts {
  /** width / height of the button body. */
  w?: number;
  h?: number;
  /** label font size. */
  fontSize?: number;
  /** filled = glossy accent pill (light text); false = dark outlined pill. */
  filled?: boolean;
}

export interface ButtonHandle {
  container: Phaser.GameObjects.Container;
  /** Update the label text (e.g. NEXT → GOT IT, or a busy "…" state). */
  setLabel: (s: string) => void;
}

/**
 * The canonical pill button used by the menu, game-over, settings and tutorial.
 * `filled` buttons get a glossy accent body, hover highlight and a gentle
 * breathing tween (the primary CTA look); outlined buttons are the quiet,
 * secondary variant.
 */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {}
): ButtonHandle {
  const w = opts.w ?? 196;
  const h = opts.h ?? 54;
  const fontSize = opts.fontSize ?? 24;
  const filled = opts.filled ?? true;
  const c = scene.add.container(x, y);

  let txt: Phaser.GameObjects.Text;
  if (filled) {
    const bg = scene.add.image(0, 0, TEX.pad).setDisplaySize(w, h).setTint(ACCENT_NUM);
    txt = createText(scene, 0, 0, label, fontSize, "#07221f").setResolution(3);
    c.add([bg, txt]);
    c.on("pointerover", () => bg.setTint(0xffffff));
    c.on("pointerout", () => bg.setTint(ACCENT_NUM));
    scene.tweens.add({
      targets: c,
      scale: { from: 1, to: 1.04 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  } else {
    const bg = scene.add.rectangle(0, 0, w, h, 0x16233d, 1).setStrokeStyle(2, ACCENT_NUM, 1);
    txt = createText(scene, 0, 0, label, fontSize, UI.ACCENT);
    c.add([bg, txt]);
  }

  c.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  });
  c.on("pointerup", onClick);

  return { container: c, setLabel: (s: string) => txt.setText(s) };
}
