import { ALL_SYMBOLS, CrossTier, CROSS_TIERS, MatchMode, Sym } from "../config/constants";

/**
 * A target carries an independent `shape` and `color`. Identity/cross modes
 * read the shape; colour mode reads the colour (the spawner decouples them).
 * Phase 6 (colour as a decoy) drops in the same way without engine changes.
 */
export interface TargetLike {
  shape: Sym;
  color: number;
}

/** A shot fired from a pad — also carries an independent shape + colour. */
export interface ShotLike {
  shape: Sym;
  color: number;
}

/** One row of the cross legend: "fire this → it destroys that". */
export interface CrossPair {
  fired: Sym;
  kills: Sym;
  /** False when this symbol is untouched by the tier (it still hits its own). */
  twisted: boolean;
}

/**
 * Single source of truth for "does this projectile destroy this target?".
 * Generalizes identity, cross-cycle, and (future) colour modes. A projectile
 * passes harmlessly through any target for which this returns false.
 */
export const MatchRules = {
  canKill(shot: ShotLike, target: TargetLike, mode: MatchMode, cross?: CrossTier): boolean {
    switch (mode) {
      case "identity":
        return shot.shape === target.shape;
      case "cross":
        return (cross ?? CROSS_TIERS[0]).kills[shot.shape] === target.shape;
      case "color":
        return shot.color === target.color;
      default:
        return false;
    }
  },

  /**
   * The tier's full mapping in pad order, so the HUD legend lines up left-to-
   * right with the launcher. Untwisted rows are flagged so the UI can dim them
   * and let the swapped ones carry the eye.
   */
  crossLegend(cross: CrossTier): CrossPair[] {
    return ALL_SYMBOLS.map((s) => ({
      fired: s,
      kills: cross.kills[s],
      twisted: cross.twisted.includes(s),
    }));
  },

  /** Only the rows this tier rewires — what the rule card and tutorial teach. */
  crossTwisted(cross: CrossTier): CrossPair[] {
    return this.crossLegend(cross).filter((p) => p.twisted);
  },
};
