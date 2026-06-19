import { MONETIZATION } from "../config/constants";
import { Storage } from "./Storage";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Monetization facade — rewarded "continue" ads, a remove-ads purchase, and the
 * ads-removed entitlement. Phaser-agnostic so any scene can call it.
 *
 * The methods below run SAFE FALLBACKS (simulated reward / local entitlement)
 * so the whole flow is testable now. To ship real ads + IAP, wire the native
 * SDKs at the marked TODOs (see STORE_LISTING.md → monetization):
 *   • Rewarded + banner: @capacitor-community/admob (AdMob app id + ad units,
 *     iOS Info.plist GADApplicationIdentifier + SKAdNetwork, Android manifest).
 *   • Remove-ads IAP: a billing plugin (StoreKit / Play Billing) with a $0.99
 *     non-consumable product; verify + restore on launch.
 */
class MonetizationService {
  private removed = false;
  private ready = false;

  async init(): Promise<void> {
    this.removed = await Storage.getAdsRemoved();
    this.ready = true;
    // NATIVE TODO: initialize AdMob + IAP here; refresh `removed` from a
    // restore/verification call so the entitlement survives reinstalls.
  }

  /** Has the user paid to remove ads? */
  isRemoved(): boolean {
    return this.removed;
  }

  /** Should ad UI (banner placeholder) be shown at all? */
  adsActive(): boolean {
    return MONETIZATION.ENABLED && this.ready && !this.removed;
  }

  /**
   * Show a rewarded ad for a continue/revive. Resolves true if the reward was
   * granted (ad watched), false if unavailable / dismissed.
   */
  async showRewarded(): Promise<boolean> {
    // NATIVE TODO: load + show AdMob rewarded; resolve true only on the reward
    // callback, false on close-without-reward / load failure.
    await delay(700); // simulate the ad
    return true;
  }

  /** Purchase "remove ads". Resolves true on success. */
  async purchaseRemoveAds(): Promise<boolean> {
    // NATIVE TODO: run the store purchase flow; only grant on a verified receipt.
    this.removed = true;
    await Storage.setAdsRemoved(true);
    return true;
  }

  /** Restore a previous "remove ads" purchase. Resolves true if entitled. */
  async restore(): Promise<boolean> {
    // NATIVE TODO: query the store for owned products and set the entitlement.
    this.removed = await Storage.getAdsRemoved();
    return this.removed;
  }
}

export const Monetization = new MonetizationService();
