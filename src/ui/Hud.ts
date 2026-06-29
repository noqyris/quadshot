import Phaser from "phaser";
import {
  ALL_SYMBOLS,
  COLORS,
  GAME,
  MatchMode,
  PhaseDef,
  SCORE,
  Sym,
  TEX,
  TIMING,
  UI,
} from "../config/constants";
import { MatchRules } from "../systems/MatchRules";
import { buildRuleVisual, ruleInstruction, ruleTitle, speedName } from "./rules";
import { createText } from "./widgets";

type LegendObj =
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Arc
  | Phaser.GameObjects.Container;

/** On-screen HUD: score, best, lives, combo badge, rule legend, phase banners. */
export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;

  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private comboBadge!: Phaser.GameObjects.Text;
  private lifePips: Phaser.GameObjects.Arc[] = [];
  private legend!: Phaser.GameObjects.Container;
  private ruleCard?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(100);
    this.build();
  }

  private text(
    x: number,
    y: number,
    content: string,
    size: number,
    color: string = UI.TEXT,
    align: "left" | "right" | "center" = "left"
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, content, {
        fontFamily: UI.FONT,
        fontSize: `${size}px`,
        color,
        fontStyle: "bold",
      })
      .setResolution(Math.max(2, Math.min(3, window.devicePixelRatio || 1)));
    if (align === "right") t.setOrigin(1, 0);
    else if (align === "center") t.setOrigin(0.5, 0);
    this.root.add(t);
    return t;
  }

  private build(): void {
    const top = 14;

    // Left column: score + best (frees the top-right corner for the pause button).
    this.text(16, top, "SCORE", 12, UI.TEXT_DIM);
    this.scoreText = this.text(16, top + 14, "0", 28);
    this.bestText = this.text(16, top + 46, "BEST  0", 13, UI.TEXT_DIM);

    // Lives pips, top-right (the very corner is left for the pause button).
    const pipR = 6;
    const gap = 18;
    const startX = GAME.WIDTH - 16 - (SCORE.START_LIVES - 1) * gap;
    for (let i = 0; i < SCORE.START_LIVES; i++) {
      const pip = this.scene.add
        .circle(startX + i * gap, top + 40, pipR, 0xfb7185)
        .setStrokeStyle(2, 0xffffff, 0.25);
      this.lifePips.push(pip);
      this.root.add(pip);
    }

    // Combo badge (hidden until multiplier > 1).
    this.comboBadge = this.text(GAME.WIDTH / 2, top + 4, "", 20, UI.ACCENT, "center");
    this.comboBadge.setVisible(false);

    // Rule legend strip.
    this.legend = this.scene.add.container(GAME.WIDTH / 2, top + 64);
    this.root.add(this.legend);
  }

  setScore(score: number): void {
    this.scoreText.setText(score.toLocaleString());
  }

  setBest(best: number): void {
    this.bestText.setText(`BEST  ${best.toLocaleString()}`);
  }

  setLives(lives: number): void {
    this.lifePips.forEach((pip, i) => {
      const alive = i < lives;
      pip.setFillStyle(alive ? 0xfb7185 : 0x33405e);
      pip.setScale(alive ? 1 : 0.8);
    });
  }

  setCombo(combo: number, multiplier: number): void {
    if (multiplier > 1) {
      this.comboBadge.setText(`x${multiplier}  •  ${combo} COMBO`).setVisible(true);
    } else {
      this.comboBadge.setVisible(false);
    }
  }

  /** Brief pop animation for the combo badge on each kill. */
  pulseCombo(): void {
    if (!this.comboBadge.visible) return;
    this.scene.tweens.add({
      targets: this.comboBadge,
      scale: { from: 1.25, to: 1 },
      duration: 160,
      ease: "Back.out",
    });
  }

  // --- Legend ----------------------------------------------------------------

  private legendIcon(shape: Sym, size = 16): Phaser.GameObjects.Image {
    return this.scene.add
      .image(0, 0, TEX.shape(shape))
      .setDisplaySize(size, size)
      .setTint(COLORS[shape])
      .setOrigin(0.5);
  }

  private legendDot(color: number, size = 16): Phaser.GameObjects.Arc {
    return this.scene.add.circle(0, 0, size / 2, color).setOrigin(0.5);
  }

  private legendText(str: string, size = 12, color: string = UI.TEXT_DIM): Phaser.GameObjects.Text {
    return createText(this.scene, 0, 0, str, size, color);
  }

  /** Lay a list of measured items out in a horizontal row, centred at local y. */
  private placeRow(items: Array<{ obj: LegendObj; w: number }>, y: number, gap: number): void {
    const total = items.reduce((s, it) => s + it.w, 0) + gap * (items.length - 1);
    let cx = -total / 2;
    for (const it of items) {
      it.obj.x = cx + it.w / 2;
      it.obj.y = y;
      this.legend.add(it.obj);
      cx += it.w + gap;
    }
  }

  /** Rebuild the legend for the active rule + symbol set. */
  setLegend(mode: MatchMode, symbols: Sym[]): void {
    this.legend.removeAll(true);
    if (mode === "cross") this.buildCrossLegend();
    else if (mode === "color") this.buildColorLegend();
    else this.buildIdentityLegend(symbols);
  }

  private buildIdentityLegend(symbols: Sym[]): void {
    const label = this.legendText("MATCH SHAPE");
    const items: Array<{ obj: LegendObj; w: number }> = [{ obj: label, w: label.width }];
    symbols.forEach((s) => items.push({ obj: this.legendIcon(s), w: 16 }));
    this.placeRow(items, 0, 8);
  }

  private buildColorLegend(): void {
    const label = this.legendText("MATCH COLOR");
    const items: Array<{ obj: LegendObj; w: number }> = [{ obj: label, w: label.width }];
    ALL_SYMBOLS.forEach((s) => items.push({ obj: this.legendDot(COLORS[s]), w: 16 }));
    this.placeRow(items, 0, 8);
  }

  private buildCrossLegend(): void {
    // Caption makes the arrow unambiguous: the left symbol you fire destroys the
    // right one. Below it, four explicit "fired → destroyed" pairs.
    const caption = this.legendText("FIRE  →  DESTROYS", 11);
    caption.x = 0;
    caption.y = -9;
    this.legend.add(caption);

    const pairs = MatchRules.crossLegend().map(([fired, target]) => ({
      obj: this.makeCrossPair(fired, target),
      w: 44,
    }));
    this.placeRow(pairs, 9, 10);
  }

  /** A single "fired → destroyed" pair as a self-contained container. */
  private makeCrossPair(fired: Sym, target: Sym): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const a = this.legendIcon(fired, 15);
    a.x = -15;
    const arrow = this.legendText("→", 12);
    const t = this.legendIcon(target, 15);
    t.x = 15;
    c.add([a, arrow, t]);
    return c;
  }

  /**
   * Prominent in-game rule card shown at the start of each phase: phase + speed,
   * the rule name, a one-line instruction, and a little visual demo of what to
   * do. Non-blocking (no backdrop) so targets stay visible/hittable behind it.
   */
  showRuleCard(phase: PhaseDef): void {
    this.ruleCard?.destroy();
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT * 0.36;
    const c = this.scene.add.container(0, 0).setDepth(120);
    this.ruleCard = c;

    const meta = createText(
      this.scene,
      cx,
      cy - 78,
      `PHASE ${phase.index}   ·   ${speedName(phase.index)}`,
      13,
      UI.ACCENT
    );

    const title = createText(this.scene, cx, cy - 42, ruleTitle(phase.mode), 40, UI.TEXT)
      .setResolution(3)
      .setShadow(0, 0, UI.ACCENT, 18, true, true);

    const instr = createText(this.scene, cx, cy + 2, ruleInstruction(phase.mode), 17, UI.TEXT_DIM);

    const demo = this.scene.add.container(0, 0);
    buildRuleVisual(this.scene, demo, cx, cy + 52, phase.mode);

    c.add([meta, title, instr, demo]);

    // Animate in (title pops), hold, fade out.
    c.setAlpha(0);
    title.setScale(0.82);
    this.scene.tweens.add({ targets: c, alpha: 1, duration: 220, ease: "Quad.out" });
    this.scene.tweens.add({ targets: title, scale: 1, duration: 300, ease: "Back.out" });
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      delay: TIMING.RULE_CARD_HOLD,
      duration: 420,
      ease: "Quad.in",
      onComplete: () => {
        if (this.ruleCard === c) this.ruleCard = undefined;
        c.destroy();
      },
    });
  }
}
