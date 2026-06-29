import Phaser from "phaser";
import { GAME, MatchMode, UI } from "../config/constants";
import { buildRuleVisual, ruleInstruction, ruleTitle } from "./rules";
import { ACCENT_NUM, createButton, createText } from "./widgets";

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

  root.add(createText(scene, cx, cy + 150, "Slide to aim   •   Tap a pad to fire", 14, UI.TEXT_DIM));

  const dots = PAGES.map((_, i) =>
    scene.add.circle(cx - (PAGES.length - 1) * 9 + i * 18, cy + 192, 4, 0x33415e)
  );
  dots.forEach((d) => root.add(d));

  let page = 0;
  const render = () => {
    content.removeAll(true);
    const mode = PAGES[page];
    content.add(createText(scene, cx, cy - 130, ruleTitle(mode), 30, UI.TEXT));
    content.add(createText(scene, cx, cy + 80, ruleInstruction(mode), 17, UI.TEXT_DIM));
    buildRuleVisual(scene, content, cx, cy - 6, mode);

    dots.forEach((d, i) => d.setFillStyle(i === page ? ACCENT_NUM : 0x33415e));
    next.setLabel(page === PAGES.length - 1 ? "GOT IT" : "NEXT");
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

  const next = createButton(scene, cx, cy + 234, "NEXT", advance, {
    w: 150,
    h: 46,
    fontSize: 18,
    filled: false,
  });
  root.add(next.container);
  dim.on("pointerup", advance);
  render();
}
