import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AppReview } from "@capawesome/capacitor-app-review";
import { APP_STORE_ID, RATING } from "../config/constants";
import { Storage } from "./Storage";

/**
 * The in-app rating prompt (StoreKit's `SKStoreReviewController` on iOS, Play
 * In-App Review on Android), behind a policy that decides when asking is fair.
 *
 * The OS owns the final word — it caps the sheet at three appearances a year
 * and silently ignores the request in TestFlight — so `requestReview()` is best
 * understood as "you may ask now", never as "show a dialog". That asymmetry
 * drives two rules here:
 *
 * • We only spend an ask at a genuinely good moment: a fresh personal best,
 *   several runs deep, and never while an ad or a purchase is in flight.
 * • The attempt is recorded BEFORE it is made. If iOS declines to draw the
 *   sheet we must not keep re-asking on every subsequent best — the player
 *   would never see it anyway, and the OS quota is not ours to burn.
 *
 * Everything fails silently: a rating prompt is the least important thing on
 * screen, and it must never take the game down with it.
 */
class RateAppService {
  private readonly native = Capacitor.isNativePlatform();
  /** One ask per launch, even across several new bests in a sitting. */
  private askedThisSession = false;

  /**
   * Ask for a review if this run earned it. A silent no-op on the web, on a
   * run that didn't beat the record, or once this build has already asked.
   */
  async maybeAsk(ctx: { isNewBest: boolean; gamesPlayed: number }): Promise<void> {
    if (!this.native || this.askedThisSession) return;
    if (!ctx.isNewBest || ctx.gamesPlayed < RATING.MIN_GAMES) return;

    const version = await this.appVersion();
    if ((await Storage.getRatePromptedVersion()) === version) return;

    this.askedThisSession = true;
    await Storage.setRatePromptedVersion(version);
    try {
      await AppReview.requestReview();
    } catch {
      /* no review UI on this OS / quota spent — nothing to recover from */
    }
  }

  /** An explicit "rate us" tap: always take them to the store page. */
  async openStore(): Promise<void> {
    try {
      if (this.native) {
        await AppReview.openAppStore({ appId: APP_STORE_ID });
      } else {
        window.open(`https://apps.apple.com/app/id${APP_STORE_ID}`, "_blank");
      }
    } catch {
      /* store unreachable; leave the UI as it was */
    }
  }

  /** Marketing version ("1.1.0") of the running build. */
  private async appVersion(): Promise<string> {
    try {
      return (await App.getInfo()).version;
    } catch {
      return "unknown";
    }
  }
}

export const RateApp = new RateAppService();
