import Phaser from "phaser";
import { GAME, MatchMode, UI } from "../config/constants";
import { buildRuleVisual, ruleInstruction, ruleTitle } from "./rules";

// The three rules, in the order the player first meets them.
const PAGES: MatchMode[] = ["identity", "color", "cross"];

/**
 * Modal 3-page rules tutorial. Tap / Next advances; the last page calls
 * `onDone`. Uses the same rule titles / instructions / demos as the in-game
 * rule card (see ui/rules.ts) so what you learn matches what you see in play.
 */
export function openTutorial(scene: Phaser.Scene, onDone: () => void): void {
  const cx = GAME.WIDTH / 2;
  const cy = GAME.HEIGHT / 2;
  const root = scene.add.container(0, 0).setDepth(210);

  const dim = scene.add
    .rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, 0x05070f, 0.92)
    .setInteractive();
  root.add(dim);

  const content = scene.add.container(0, 0);
  root.add(content);

  root.add(txt(scene, cx, cy + 150, "Slide to aim   •   Tap a pad to fire", 14, UI.TEXT_DIM));

  const accent = Phaser.Display.Color.HexStringToColor(UI.ACCENT).color;
  const dots = PAGES.map((_, i) =>
    scene.add.circle(cx - (PAGES.length - 1) * 9 + i * 18, cy + 192, 4, 0x33415e)
  );
  dots.forEach((d) => root.add(d));

  const nextBtn = scene.add.container(cx, cy + 234);
  const nextBg = scene.add.rectangle(0, 0, 150, 46, 0x16233d, 1).setStrokeStyle(2, accent, 1);
  const nextTxt = txt(scene, 0, 0, "NEXT", 18, UI.ACCENT);
  nextBtn.add([nextBg, nextTxt]);
  nextBtn.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle(-75, -23, 150, 46),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  });
  root.add(nextBtn);

  let page = 0;
  const render = () => {
    content.removeAll(true);
    const mode = PAGES[page];
    content.add(txt(scene, cx, cy - 130, ruleTitle(mode), 30, UI.TEXT));
    content.add(txt(scene, cx, cy + 80, ruleInstruction(mode), 17, UI.TEXT_DIM));
    buildRuleVisual(scene, content, cx, cy - 6, mode);

    dots.forEach((d, i) => d.setFillStyle(i === page ? accent : 0x33415e));
    nextTxt.setText(page === PAGES.length - 1 ? "GOT IT" : "NEXT");
  };

  const advance = () => {
    if (page < PAGES.length - 1) {
      page += 1;
      render();
    } else {
      root.destroy();
      onDone();
    }
  };

  nextBtn.on("pointerup", advance);
  dim.on("pointerup", advance);
  render();
}

function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: string
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, {
      fontFamily: UI.FONT,
      fontSize: `${size}px`,
      color,
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setResolution(2);
}
