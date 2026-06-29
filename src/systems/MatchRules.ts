import { CROSS_CYCLE, MatchMode, Sym } from "../config/constants";

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

/** Pre-computed "X kills Y" map for the cross-cycle so lookups are O(1). */
const CROSS_KILLS: Record<Sym, Sym> = buildCrossKills();

function buildCrossKills(): Record<Sym, Sym> {
  const map = {} as Record<Sym, Sym>;
  for (let i = 0; i < CROSS_CYCLE.length; i++) {
    const proj = CROSS_CYCLE[i];
    const victim = CROSS_CYCLE[(i + 1) % CROSS_CYCLE.length];
    map[proj] = victim;
  }
  return map;
}

/**
 * Single source of truth for "does this projectile destroy this target?".
 * Generalizes identity, cross-cycle, and (future) colour modes. A projectile
 * passes harmlessly through any target for which this returns false.
 */
export const MatchRules = {
  canKill(shot: ShotLike, target: TargetLike, mode: MatchMode): boolean {
    switch (mode) {
      case "identity":
        return shot.shape === target.shape;
      case "cross":
        return CROSS_KILLS[shot.shape] === target.shape;
      case "color":
        return shot.color === target.color;
      default:
        return false;
    }
  },

  /** Ordered legend pairs ([fired, destroys]) for the HUD in cross mode. */
  crossLegend(): Array<[Sym, Sym]> {
    return CROSS_CYCLE.map((s) => [s, CROSS_KILLS[s]] as [Sym, Sym]);
  },
};
