import Phaser from "phaser";
import { COLORS, MatchMode, Sym, TEX, UI } from "../config/constants";
import { MatchRules } from "../systems/MatchRules";

/**
 * Single source of truth for how each rule is explained to the player — used by
 * both the first-run tutorial and the in-game rule card so the wording and the
 * little demo always match.
 */
export function ruleTitle(mode: MatchMode): string {
  switch (mode) {
    case "color":
      return "MATCH THE COLOR";
    case "cross":
      return "CROSS-MATCH";
    default:
      return "MATCH THE SHAPE";
  }
}

export function ruleInstruction(mode: MatchMode): string {
  switch (mode) {
    case "color":
      return "Ignore the shape — hit by COLOR";
    case "cross":
      return "Fire one — it destroys the NEXT";
    default:
      return "Hit each symbol with its own pad";
  }
}

const SPEEDS = ["SLOW", "MEDIUM", "FAST"];
export function speedName(phaseIndex: number): string {
  return SPEEDS[Math.min(SPEEDS.length - 1, Math.floor((phaseIndex - 1) / 3))];
}

function icon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shape: Sym,
  color: number,
  size: number
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, TEX.shape(shape)).setDisplaySize(size, size).setTint(color);
}

function arrow(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, "→", {
      fontFamily: UI.FONT,
      fontSize: `${size}px`,
      color: UI.TEXT_DIM,
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setResolution(2);
}

/** Draw the little "what to do" demo for a rule, centred at (cx, cy), into `parent`. */
export function buildRuleVisual(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  mode: MatchMode,
  s = 1
): void {
  if (mode === "color") {
    // A red-coloured triangle is destroyed by the red (circle) pad — colour wins.
    const red = COLORS[Sym.CIRCLE];
    parent.add(icon(scene, cx - 58 * s, cy, Sym.TRIANGLE, red, 44 * s));
    parent.add(arrow(scene, cx, cy, 24 * s));
    parent.add(icon(scene, cx + 58 * s, cy, Sym.CIRCLE, red, 44 * s));
    parent.add(
      scene.add
        .text(cx, cy + 36 * s, "same COLOR", {
          fontFamily: UI.FONT,
          fontSize: `${12 * s}px`,
          color: UI.TEXT_DIM,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setResolution(2)
    );
  } else if (mode === "cross") {
    const pairs = MatchRules.crossLegend();
    const spread = 92 * s;
    pairs.forEach(([fired, target], i) => {
      const px = cx - ((pairs.length - 1) * spread) / 2 + i * spread;
      parent.add(icon(scene, px - 17 * s, cy, fired, COLORS[fired], 26 * s));
      parent.add(arrow(scene, px, cy, 13 * s));
      parent.add(icon(scene, px + 17 * s, cy, target, COLORS[target], 26 * s));
    });
  } else {
    const syms = [Sym.TRIANGLE, Sym.CIRCLE, Sym.CROSS, Sym.SQUARE];
    const spread = 64 * s;
    syms.forEach((sym, i) =>
      parent.add(icon(scene, cx - ((syms.length - 1) * spread) / 2 + i * spread, cy, sym, COLORS[sym], 40 * s))
    );
  }
}
