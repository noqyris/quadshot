import { DESIGN_HEIGHT, GAME, MatchMode, PHASES, PhaseDef, Sym } from "../config/constants";

/**
 * Owns the active phase. The 9 phases are score-gated; each phase carries a
 * fixed speed tier (fall speed + spawn interval) so the three speeds are clean
 * and predictable — no continuous ramp. Phase changes fire `onPhaseChange`.
 */
export class Difficulty {
  private phase: PhaseDef = PHASES[0];
  /** Dev override: when set, the phase is pinned and score-gating is disabled. */
  private forcedPhase: number | null = null;

  /** Fired once whenever the phase advances (never on the very first phase). */
  onPhaseChange?: (phase: PhaseDef, previous: PhaseDef) => void;

  reset(): void {
    this.phase = PHASES[0];
    this.forcedPhase = null;
  }

  /** Re-evaluate the phase from the latest score (unless pinned by dev). */
  update(_deltaMs: number, score: number): void {
    if (this.forcedPhase === null) this.checkPhase(score);
  }

  /** Dev-only: pin the game to a phase (1-based). */
  devForcePhase(index: number): void {
    this.forcedPhase = index;
    this.phase = PHASES[index - 1];
  }

  private checkPhase(score: number): void {
    // Highest phase whose threshold the score has reached.
    let next = PHASES[0];
    for (const p of PHASES) {
      if (score >= p.scoreThreshold) next = p;
    }
    if (next.index !== this.phase.index) {
      const prev = this.phase;
      this.phase = next;
      this.onPhaseChange?.(next, prev);
    }
  }

  getFallSpeed(): number {
    // Scale with the (dynamic) field height so time-to-fall stays consistent
    // regardless of how tall the device is.
    return this.phase.fallSpeed * (GAME.HEIGHT / DESIGN_HEIGHT);
  }

  getSpawnInterval(): number {
    return this.phase.spawnInterval;
  }

  getPhase(): PhaseDef {
    return this.phase;
  }

  getMode(): MatchMode {
    return this.phase.mode;
  }

  getActiveSymbols(): Sym[] {
    return this.phase.symbols;
  }

  /** Index of the next phase's threshold, or null if already at the last phase. */
  getNextThreshold(): number | null {
    const next = PHASES.find((p) => p.index === this.phase.index + 1);
    return next ? next.scoreThreshold : null;
  }
}
