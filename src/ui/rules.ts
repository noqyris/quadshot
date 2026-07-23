import Phaser from "phaser";
import {
  ALL_SYMBOLS,
  COLORS,
  CrossTier,
  CROSS_TIERS,
  MatchMode,
  SPEED_NAMES,
  SYM_NAME,
  Sym,
  TEX,
  UI,
} from "../config/constants";
import { MatchRules } from "../systems/MatchRules";
import { createText } from "./widgets";

/**
 * Single source of truth for how each rule is explained to the player — used by
 * both the first-run tutorial and the in-game rule card so the wording and the
 * little demo always match. Cross phases pass the live tier; everything that
 * omits it (the tutorial) teaches the first rung.
 */
export function ruleTitle(mode: MatchMode, cross?: CrossTier): string {
  switch (mode) {
    case "color":
      return "MATCH THE COLOR";
    case "cross":
      return (cross ?? CROSS_TIERS[0]).title;
    default:
      return "MATCH THE SHAPE";
  }
}

export function ruleInstruction(mode: MatchMode, cross?: CrossTier): string {
  switch (mode) {
    case "color":
      return "Ignore the shape — hit by COLOR";
    case "cross":
      return (cross ?? CROSS_TIERS[0]).instruction;
    default:
      return "Hit each symbol with its own pad";
  }
}

export function speedName(phaseIndex: number): string {
  return SPEED_NAMES[Math.min(SPEED_NAMES.length - 1, Math.floor((phaseIndex - 1) / 3))];
}

/**
 * Footnote for a cross tier: names the symbols it left alone, so the demo above
 * only ever shows what changed. Once nothing is left alone, that itself is the
 * headline ("nothing hits its own").
 */
function untouchedNote(tier: CrossTier): string {
  const rest = ALL_SYMBOLS.filter((s) => !tier.twisted.includes(s)).map((s) => SYM_NAME[s]);
  if (rest.length === 0) return "nothing hits its own";
  if (rest.length === 1) return `${rest[0]} still hits its own`;
  return `${rest.join(" and ")} still hit their own`;
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
  return createText(scene, x, y, "→", size, UI.TEXT_DIM);
}

/** Draw the little "what to do" demo for a rule, centred at (cx, cy), into `parent`. */
export function buildRuleVisual(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  mode: MatchMode,
  cross?: CrossTier,
  s = 1
): void {
  if (mode === "color") {
    // A red-coloured triangle is destroyed by the red (circle) pad — colour wins.
    const red = COLORS[Sym.CIRCLE];
    parent.add(icon(scene, cx - 58 * s, cy, Sym.TRIANGLE, red, 44 * s));
    parent.add(arrow(scene, cx, cy, 24 * s));
    parent.add(icon(scene, cx + 58 * s, cy, Sym.CIRCLE, red, 44 * s));
    parent.add(createText(scene, cx, cy + 36 * s, "same COLOR", 12 * s, UI.TEXT_DIM));
  } else if (mode === "cross") {
    // Teach only what this tier rewires — one pair, two pairs, or a three-way
    // rotation. The untouched symbols are covered by the footnote instead of
    // padding the demo with rows that say "unchanged".
    const tier = cross ?? CROSS_TIERS[0];
    const pairs = MatchRules.crossTwisted(tier);
    const tight = pairs.length > 2;
    const spread = (tight ? 92 : 116) * s;
    const size = (tight ? 26 : 34) * s;
    const off = (tight ? 17 : 22) * s;
    pairs.forEach(({ fired, kills }, i) => {
      const px = cx - ((pairs.length - 1) * spread) / 2 + i * spread;
      parent.add(icon(scene, px - off, cy, fired, COLORS[fired], size));
      parent.add(arrow(scene, px, cy, 13 * s));
      parent.add(icon(scene, px + off, cy, kills, COLORS[kills], size));
    });
    parent.add(createText(scene, cx, cy + 36 * s, untouchedNote(tier), 12 * s, UI.TEXT_DIM));
  } else {
    const syms = [Sym.TRIANGLE, Sym.CIRCLE, Sym.CROSS, Sym.SQUARE];
    const spread = 64 * s;
    syms.forEach((sym, i) =>
      parent.add(icon(scene, cx - ((syms.length - 1) * spread) / 2 + i * spread, cy, sym, COLORS[sym], 40 * s))
    );
  }
}
