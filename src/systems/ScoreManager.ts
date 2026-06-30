import { SCORE } from "../config/constants";

/**
 * Tracks score, combo, multiplier and lives.
 *
 * multiplier = clamp(1 + floor(combo / COMBO_PER_STEP), 1, MAX_MULTIPLIER)
 * points per kill = BASE_POINTS * multiplier
 */
export class ScoreManager {
  score = 0;
  combo = 0;
  lives: number = SCORE.START_LIVES;

  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.lives = SCORE.START_LIVES;
  }

  get multiplier(): number {
    const m = 1 + Math.floor(this.combo / SCORE.COMBO_PER_STEP);
    return Math.min(Math.max(m, 1), SCORE.MAX_MULTIPLIER);
  }

  /**
   * Register a kill. Score is a flat 1 point per destroyed obstacle; the
   * multiplier is returned only so the caller can scale the visual juice.
   */
  registerKill(): { points: number; combo: number; multiplier: number } {
    const points = SCORE.BASE_POINTS; // flat: one obstacle = one point
    this.score += points;
    this.combo += 1;
    return { points, combo: this.combo, multiplier: this.multiplier };
  }

  /** Register a miss. Resets combo and costs a life. Returns lives remaining. */
  registerMiss(): number {
    this.combo = 0;
    this.lives = Math.max(0, this.lives - 1);
    return this.lives;
  }

  get isGameOver(): boolean {
    return this.lives <= 0;
  }
}
