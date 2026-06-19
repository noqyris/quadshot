import Phaser from "phaser";
import { COLORS, TARGET } from "../config/constants";
import { Target } from "../objects/Target";
import { Difficulty } from "./Difficulty";

/**
 * Drip-feeds falling targets from a pooled group. Spawn cadence, fall speed and
 * the set of allowed symbols all come from the current Difficulty state.
 */
export class Spawner {
  private timer = 0;
  private interval = 1500;

  constructor(private readonly group: Phaser.GameObjects.Group) {}

  reset(): void {
    this.timer = 0;
    this.interval = 1500;
  }

  update(deltaMs: number, difficulty: Difficulty): void {
    this.timer += deltaMs;
    this.interval = difficulty.getSpawnInterval();
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      this.spawnOne(difficulty);
    }
  }

  private spawnOne(difficulty: Difficulty): void {
    const symbols = difficulty.getActiveSymbols();
    const shape = Phaser.Utils.Array.GetRandom(symbols);
    // In colour mode shape and colour are decoupled (shape becomes a decoy):
    // the colour is picked independently, so you must match by colour, not shape.
    const colorSym =
      difficulty.getMode() === "color" ? Phaser.Utils.Array.GetRandom(symbols) : shape;
    const x = Phaser.Math.Between(TARGET.MIN_X, TARGET.MAX_X);
    const target = this.group.get() as Target | null;
    if (!target) return; // pool exhausted (maxSize); skip this spawn
    target.spawn(x, shape, COLORS[colorSym], difficulty.getFallSpeed());
  }
}
