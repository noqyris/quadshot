import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { HIGH_SCORE_COUNT, STORE_KEYS } from "../config/constants";

/** Lifetime aggregate stats. */
export interface Stats {
  gamesPlayed: number;
  totalKills: number;
  bestCombo: number;
  bestPhase: number;
}

const EMPTY_STATS: Stats = {
  gamesPlayed: 0,
  totalKills: 0,
  bestCombo: 0,
  bestPhase: 1,
};

/** One finished run, recorded for stats + high scores. */
export interface RunResult {
  score: number;
  kills: number;
  bestCombo: number;
  phase: number;
}

/**
 * Persistence abstraction.
 *
 * Uses @capacitor/preferences when running as a native app, and falls back to
 * localStorage on the web. All methods are async so the same call sites work
 * for both backends.
 */
class StorageService {
  private get native(): boolean {
    return Capacitor.isNativePlatform();
  }

  private async getRaw(key: string): Promise<string | null> {
    if (this.native) {
      try {
        const { value } = await Preferences.get({ key });
        return value;
      } catch {
        return null;
      }
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private async setRaw(key: string, value: string): Promise<void> {
    if (this.native) {
      try {
        await Preferences.set({ key, value });
      } catch {
        /* preferences unavailable; fail silently */
      }
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage may be unavailable (private mode); fail silently */
    }
  }

  async getBestScore(): Promise<number> {
    const raw = await this.getRaw(STORE_KEYS.BEST);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  /** Persist `score` only if it beats the stored best. Returns the new best. */
  async submitScore(score: number): Promise<number> {
    const best = await this.getBestScore();
    if (score > best) {
      await this.setRaw(STORE_KEYS.BEST, String(score));
      return score;
    }
    return best;
  }

  async getMuted(): Promise<boolean> {
    const raw = await this.getRaw(STORE_KEYS.MUTE);
    return raw === "1" || raw === "true";
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.setRaw(STORE_KEYS.MUTE, muted ? "1" : "0");
  }

  /** Haptics default ON. */
  async getHaptics(): Promise<boolean> {
    const raw = await this.getRaw(STORE_KEYS.HAPTICS);
    return raw === null ? true : raw === "1" || raw === "true";
  }

  async setHaptics(on: boolean): Promise<void> {
    await this.setRaw(STORE_KEYS.HAPTICS, on ? "1" : "0");
  }

  async getStats(): Promise<Stats> {
    const raw = await this.getRaw(STORE_KEYS.STATS);
    if (!raw) return { ...EMPTY_STATS };
    try {
      return { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<Stats>) };
    } catch {
      return { ...EMPTY_STATS };
    }
  }

  async getHighScores(): Promise<number[]> {
    const raw = await this.getRaw(STORE_KEYS.SCORES);
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw) as number[];
      return Array.isArray(arr) ? arr.filter((n) => Number.isFinite(n)) : [];
    } catch {
      return [];
    }
  }

  /**
   * Record a finished run: updates best score, lifetime stats and the local
   * high-score table in one call. Returns the fresh best + stats + scores.
   */
  async recordRun(
    run: RunResult
  ): Promise<{ best: number; stats: Stats; scores: number[] }> {
    const best = await this.submitScore(run.score);

    const stats = await this.getStats();
    const next: Stats = {
      gamesPlayed: stats.gamesPlayed + 1,
      totalKills: stats.totalKills + run.kills,
      bestCombo: Math.max(stats.bestCombo, run.bestCombo),
      bestPhase: Math.max(stats.bestPhase, run.phase),
    };
    await this.setRaw(STORE_KEYS.STATS, JSON.stringify(next));

    const scores = await this.getHighScores();
    scores.push(run.score);
    scores.sort((a, b) => b - a);
    const top = scores.slice(0, HIGH_SCORE_COUNT);
    await this.setRaw(STORE_KEYS.SCORES, JSON.stringify(top));

    return { best, stats: next, scores: top };
  }

  async resetProgress(): Promise<void> {
    await this.setRaw(STORE_KEYS.BEST, "0");
    await this.setRaw(STORE_KEYS.STATS, JSON.stringify(EMPTY_STATS));
    await this.setRaw(STORE_KEYS.SCORES, JSON.stringify([]));
  }

  async getTutorialSeen(): Promise<boolean> {
    const raw = await this.getRaw(STORE_KEYS.TUTORIAL);
    return raw === "1" || raw === "true";
  }

  async setTutorialSeen(): Promise<void> {
    await this.setRaw(STORE_KEYS.TUTORIAL, "1");
  }

  /** The "remove ads" entitlement. Mirrored locally; verify via the store on launch. */
  async getAdsRemoved(): Promise<boolean> {
    const raw = await this.getRaw(STORE_KEYS.ADS_REMOVED);
    return raw === "1" || raw === "true";
  }

  async setAdsRemoved(removed: boolean): Promise<void> {
    await this.setRaw(STORE_KEYS.ADS_REMOVED, removed ? "1" : "0");
  }
}

export const Storage = new StorageService();
