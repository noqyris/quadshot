import Phaser from "phaser";
import {
  ALL_SYMBOLS,
  COLORS,
  CrossTier,
  CROSS_TIERS,
  GAME,
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
  private pipGlows: Phaser.GameObjects.Image[] = [];
  private legend!: Phaser.GameObjects.Container;
  private ruleCard?: Phaser.GameObjects.Container;

  private lastScore = 0;
  private lastLives: number = SCORE.START_LIVES;
  private comboShown = false;

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
    const top = 16;

    // Left column: score + best. Kept off-centre (clear of the notch / Dynamic
    // Island) and given room so the score reads big and clear.
    this.text(16, top, "SCORE", 12, UI.TEXT_DIM);
    this.scoreText = this.text(16, top + 16, "0", 36).setShadow(0, 0, UI.ACCENT, 18, true, true);
    this.bestText = this.text(16, top + 62, "BEST  0", 13, UI.TEXT_DIM);

    // Lives pips, top-right (off-centre too; the very corner is the pause button).
    const pipR = 6;
    const gap = 18;
    const pipY = top + 30;
    const startX = GAME.WIDTH - 16 - (SCORE.START_LIVES - 1) * gap;
    for (let i = 0; i < SCORE.START_LIVES; i++) {
      const px = startX + i * gap;
      const glow = this.scene.add
        .image(px, pipY, TEX.glow)
        .setDisplaySize(26, 26)
        .setTint(0xfb7185)
        .setAlpha(0.45)
        .setBlendMode(Phaser.BlendModes.ADD);
      const pip = this.scene.add
        .circle(px, pipY, pipR, 0xfb7185)
        .setStrokeStyle(2, 0xffffff, 0.25);
      this.pipGlows.push(glow);
      this.lifePips.push(pip);
      this.root.add(glow);
      this.root.add(pip);
    }

    // Centre column lives BELOW the Dynamic Island zone (the island sits dead
    // centre at the very top), so the combo badge + rule legend are pushed down.
    this.comboBadge = this.text(GAME.WIDTH / 2, top + 48, "", 20, UI.ACCENT, "center");
    this.comboBadge.setVisible(false);

    // Rule legend strip.
    this.legend = this.scene.add.container(GAME.WIDTH / 2, top + 84);
    this.root.add(this.legend);
  }

  /** Set the score with no animation — for the initial / resumed value. */
  initScore(score: number): void {
    this.scoreText.setText(score.toLocaleString());
    this.lastScore = score;
  }

  setScore(score: number): void {
    this.scoreText.setText(score.toLocaleString());
    // A small tactile twitch on each gain (skip the initial 0 / no-op sets).
    if (score > this.lastScore) {
      this.scene.tweens.killTweensOf(this.scoreText);
      this.scene.tweens.add({
        targets: this.scoreText,
        scale: { from: 1.12, to: 1 },
        duration: 200,
        ease: "Back.out",
      });
    }
    this.lastScore = score;
  }

  setBest(best: number): void {
    this.bestText.setText(`BEST  ${best.toLocaleString()}`);
  }

  setLives(lives: number): void {
    this.lifePips.forEach((pip, i) => {
      const glow = this.pipGlows[i];
      const wasAlive = i < this.lastLives;
      const nowAlive = i < lives;
      if (wasAlive && !nowAlive) this.killPip(pip, glow);
      else if (!wasAlive && nowAlive) this.revivePip(pip, glow);
      else {
        pip.setFillStyle(nowAlive ? 0xfb7185 : 0x33405e).setScale(nowAlive ? 1 : 0.8);
        glow.setAlpha(nowAlive ? 0.45 : 0);
      }
    });
    this.lastLives = lives;
  }

  private killPip(pip: Phaser.GameObjects.Arc, glow: Phaser.GameObjects.Image): void {
    const tw = this.scene.tweens;
    tw.killTweensOf(pip);
    pip.setStrokeStyle(3, 0xff8a9a, 1); // bright damage rim flash
    // Pop up, then collapse into the dim "spent" state.
    tw.add({
      targets: pip,
      scale: 1.35,
      duration: 90,
      ease: "Back.out",
      onComplete: () => {
        pip.setFillStyle(0x33405e).setStrokeStyle(2, 0xffffff, 0.25);
        tw.add({ targets: pip, scale: 0.8, duration: 200, ease: "Quad.in" });
      },
    });
    tw.killTweensOf(glow);
    tw.add({ targets: glow, alpha: 0, scale: glow.scaleX * 1.4, duration: 240, ease: "Quad.out" });
  }

  private revivePip(pip: Phaser.GameObjects.Arc, glow: Phaser.GameObjects.Image): void {
    const tw = this.scene.tweens;
    tw.killTweensOf(pip);
    tw.killTweensOf(glow);
    pip.setFillStyle(0xfb7185).setStrokeStyle(2, 0xffffff, 0.25);
    glow.setAlpha(0.45);
    tw.add({ targets: pip, scale: { from: 0.5, to: 1 }, duration: 300, ease: "Back.out" });
  }

  setCombo(combo: number, multiplier: number): void {
    if (multiplier > 1) {
      this.comboBadge.setText(`${combo}  STREAK`).setVisible(true);
      if (!this.comboShown) {
        this.comboShown = true;
        this.comboBadge.setShadow(0, 0, UI.ACCENT, 12, true, true);
        this.scene.tweens.add({
          targets: this.comboBadge,
          scale: { from: 1.3, to: 1 },
          duration: 200,
          ease: "Back.out",
        });
      }
    } else {
      this.comboBadge.setVisible(false);
      this.comboShown = false;
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

  /** Rebuild the legend for the active phase's rule. */
  setLegend(phase: PhaseDef): void {
    this.legend.removeAll(true);
    if (phase.mode === "cross") this.buildCrossLegend(phase.cross ?? CROSS_TIERS[0]);
    else if (phase.mode === "color") this.buildColorLegend();
    else this.buildIdentityLegend(phase.symbols);
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

  private buildCrossLegend(cross: CrossTier): void {
    // Caption makes the arrow unambiguous: the left symbol you fire destroys the
    // right one. Below it, all four "fired → destroyed" pairs in pad order —
    // the rows this tier rewires burn bright, the untouched ones sit back, so a
    // glance answers "what changed?" without re-reading the whole strip.
    const caption = this.legendText("FIRE  →  DESTROYS", 11);
    caption.x = 0;
    caption.y = -9;
    this.legend.add(caption);

    const pairs = MatchRules.crossLegend(cross).map((p) => ({
      obj: this.makeCrossPair(p.fired, p.kills, p.twisted),
      w: 44,
    }));
    this.placeRow(pairs, 9, 10);
  }

  /** A single "fired → destroyed" pair as a self-contained container. */
  private makeCrossPair(fired: Sym, target: Sym, twisted: boolean): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const a = this.legendIcon(fired, 15);
    a.x = -15;
    const arrow = this.legendText("→", 12);
    const t = this.legendIcon(target, 15);
    t.x = 15;
    c.add([a, arrow, t]);
    if (!twisted) c.setAlpha(0.34);
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

    const title = createText(this.scene, cx, cy - 42, ruleTitle(phase.mode, phase.cross), 40, UI.TEXT)
      .setResolution(3)
      .setShadow(0, 0, UI.ACCENT, 18, true, true);

    const instr = createText(
      this.scene,
      cx,
      cy + 2,
      ruleInstruction(phase.mode, phase.cross),
      17,
      UI.TEXT_DIM
    );

    const demo = this.scene.add.container(0, 0);
    buildRuleVisual(this.scene, demo, cx, cy + 52, phase.mode, phase.cross);

    c.add([meta, title, instr, demo]);

    // Animate in — the card fades up, the title pops from small with a slight
    // rise, and the instruction + demo trail in just behind it.
    const tw = this.scene.tweens;
    c.setAlpha(0);
    title.setScale(0.55);
    title.y -= 14;
    instr.setAlpha(0);
    demo.setAlpha(0);
    tw.add({ targets: c, alpha: 1, duration: 200, ease: "Quad.out" });
    tw.add({ targets: title, scale: 1, y: cy - 42, duration: 420, ease: "Back.out" });
    tw.add({ targets: [instr, demo], alpha: 1, delay: 200, duration: 260, ease: "Quad.out" });
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
