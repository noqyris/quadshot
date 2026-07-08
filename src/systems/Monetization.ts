import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  RewardAdPluginEvents,
} from "@capacitor-community/admob";
import { adUnits } from "../config/adUnits";
import { MONETIZATION } from "../config/constants";
import { Storage } from "./Storage";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));


/** A rewarded video plus its end card. Only guards a wedged SDK, not a slow viewer. */
const REWARD_DISMISS_TIMEOUT_MS = 300_000;
const INTERSTITIAL_DISMISS_TIMEOUT_MS = 120_000;
const ENTITLEMENT_WAIT_MS = 8_000;

type TrackingStatus = "authorized" | "denied" | "notDetermined" | "restricted";
/**
 * Consent outcome:
 *   AdmobConsentStatus  — UMP answered; act on it
 *   "unavailable"       — UMP itself failed (network, propagation, misconfig).
 *                         We cannot learn the user's region, so we serve
 *                         NON-PERSONALISED ads rather than zero ads.
 *   null                — a KNOWN consent-required user we cannot ask. No ads.
 */
type ConsentOutcome = AdmobConsentStatus | "unavailable" | null;
type IapModule = typeof import("capacitor-plugin-cdv-purchase");
type IapPlatform = IapModule["Platform"][keyof IapModule["Platform"]];

/**
 * `AdMob.addListener` is overloaded per event enum, so a variable event name
 * doesn't typecheck. None of the events we wait on carry a payload we need.
 */
type AnyAdListener = (event: string, cb: () => void) => Promise<PluginListenerHandle>;
const addAdListener = AdMob.addListener as unknown as AnyAdListener;

/**
 * Monetization facade — rewarded "continue" and a capped interstitial.
 * Phaser-agnostic so any scene can call it.
 *
 * Design notes, each one paid for:
 *
 * • STOREKIT NEVER WAKES AT LAUNCH. `capacitor-plugin-cdv-purchase` started a
 *   `Transaction.updates` observer from Capacitor's `load()`, which runs at app
 *   launch before any JS. On a device with no Apple Account signed in, iOS then
 *   presents a "Sign in to Apple Account" sheet over the game. Lazy-importing the
 *   module cannot prevent that — the native plugin does it on its own. So the
 *   plugin is patched (see patches/) to move the observer into its `init(_:)`
 *   method, which only fires when JS calls `store.initialize()` — i.e. from
 *   `warmIap()`, on user intent. Verified on an erased simulator: zero StoreKit
 *   activity at boot.
 *
 * • NO BANNER. A native banner is pinned to the bottom of the *window*, outside
 *   the Phaser canvas — the exact strip the launcher pads occupy
 *   (LAUNCHER.Y = H-74, hit radius 44). See MONETIZATION.SHOW_BANNER.
 *
 * • `npa` (non-personalized ads) is a PER-REQUEST flag on AdOptions, default
 *   false. Forgetting it on one call silently serves personalized ads to a user
 *   who refused. So every request goes through `adOpts()`, and `npa` starts
 *   `true` (fail closed) until ATT *and* UMP consent both say otherwise.
 *
 * • `showInterstitial()` / `showRewardVideoAd()` resolve when the ad is SHOWN,
 *   not when it is dismissed. Navigating on that promise starts a scene
 *   transition behind a full-screen ad. We wait for the Dismissed event.
 *
 * Web/dev builds hit safe fallbacks so the CDP harness still works.
 */
class MonetizationService {
  private readonly native = Capacitor.isNativePlatform();

  private removed = false;
  private ready = false;

  /** Ads permitted this session (SDK initialized, consent resolved). */
  private canServeAds = false;
  /** Fail closed: no personalization until ATT + UMP both grant it. */
  private npa = true;

  private adsReady: Promise<void> = Promise.resolve();
  private iapReady: Promise<void> = Promise.resolve();
  /** StoreKit is only ever touched on user intent. See warmIap(). */
  private iapStarted = false;

  private iap: IapModule | null = null;
  private platform: IapPlatform | null = null;
  /** Localized, currency-correct price string from the store. Never hardcoded. */
  private price = "";

  private lastInterstitialAt = 0;

  // --- lifecycle -------------------------------------------------------------

  async init(): Promise<void> {
    this.removed = await Storage.getAdsRemoved();
    this.ready = true;

    if (!this.native || !MONETIZATION.ENABLED) return;

    // Do NOT await — awaited at each point of use, so boot never blocks on it.
    this.adsReady = this.initAds().catch(() => {
      this.canServeAds = false;
    });
  }

  /**
   * Order matters. Apple: ATT before touching the IDFA. Google: gather consent
   * before initializing the Mobile Ads SDK. ATT → UMP → initialize satisfies both.
   */
  private async initAds(): Promise<void> {
    const att = await this.requestAtt();
    const consent = await this.gatherConsent();
    if (consent === null) {
      this.canServeAds = false; // known consent-required user, no form: serve nothing
      return;
    }

    await AdMob.initialize({
      initializeForTesting: false,
      // Guideline 2.5.18 wants ads appropriate to the app's age rating. This is
      // the right control — NOT tagForChildDirectedTreatment, which is a COPPA
      // "directed to children" declaration that would drag the app under Play's
      // Families ads policy (certified SDKs only, no advertising id).
      maxAdContentRating: MaxAdContentRating.General,
    });

    // "unavailable" never counts as consent: it forces non-personalised ads.
    const consented =
      consent === AdmobConsentStatus.OBTAINED || consent === AdmobConsentStatus.NOT_REQUIRED;
    this.npa = !(att === "authorized" && consented);
    this.canServeAds = true;
  }

  /** iOS only. On Android the plugin hardcodes "authorized"; consent alone drives npa. */
  private async requestAtt(): Promise<TrackingStatus> {
    if (Capacitor.getPlatform() !== "ios") return "authorized";
    try {
      let { status } = await AdMob.trackingAuthorizationStatus();
      if (status === "notDetermined") {
        await AdMob.requestTrackingAuthorization();
        status = (await AdMob.trackingAuthorizationStatus()).status;
      }
      return status as TrackingStatus;
    } catch {
      return "denied";
    }
  }

  /**
   * Gather consent. Retries once, because `requestConsentInfo()` throws outright
   * when the publisher's UMP message is missing or still propagating (Google
   * warns a newly published message "may take up to an hour to appear").
   *
   * Fail CLOSED only for a user we KNOW needs consent and cannot be asked.
   * Fail SAFE (non-personalised ads) when UMP itself is unreachable — otherwise a
   * single transient error silently zeroes out every ad in the app, forever, with
   * nothing on screen to show for it. That failure was observed on a real build.
   */
  private async gatherConsent(): Promise<ConsentOutcome> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const info = await AdMob.requestConsentInfo();

        if (info.status === AdmobConsentStatus.REQUIRED) {
          // Known consent-required user. If no form can be shown, serve nothing.
          if (!info.isConsentFormAvailable) return null;
          const after = await AdMob.showConsentForm();
          return after.status === AdmobConsentStatus.OBTAINED ? after.status : null;
        }

        // UNKNOWN = the info update never completed. Retry, then fail safe.
        if (info.status === AdmobConsentStatus.UNKNOWN) {
          await delay(1500);
          continue;
        }

        return info.status; // OBTAINED | NOT_REQUIRED
      } catch {
        await delay(1500); // transient: retry once
      }
    }
    return "unavailable";
  }

  /** Re-open the consent form. Google's EU policy requires a persistent entry point. */
  async resetConsent(): Promise<void> {
    if (!this.native) return;
    try {
      await AdMob.resetConsentInfo();
    } catch {
      /* ignore */
    }
  }

  // --- IAP (never at boot) -----------------------------------------------------

  /**
   * Start StoreKit. NEVER called from boot — only when the player opens Settings,
   * taps Remove Ads, or taps Restore. Memoized.
   *
   * Cost of laziness: after a reinstall the entitlement is re-granted on the
   * first Settings open (or Restore tap) rather than silently at launch. Apple
   * mandates that Restore button anyway; a surprise system sheet at launch is
   * strictly worse.
   */
  warmIap(): Promise<void> {
    if (!this.native || !MONETIZATION.ENABLED) return this.iapReady;
    if (!this.iapStarted) {
      this.iapStarted = true;
      this.iapReady = this.initIap().catch(() => {
        /* keep the local entitlement mirror authoritative */
      });
    }
    return this.iapReady;
  }

  /** Resolves once the localized price is known (or the fetch has failed). */
  whenPriceReady(): Promise<void> {
    return this.warmIap();
  }

  private async initIap(): Promise<void> {
    const mod = await import("capacitor-plugin-cdv-purchase");
    this.iap = mod;
    const { store, Platform, ProductType } = mod;

    this.platform =
      Capacitor.getPlatform() === "ios" ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;

    store.register([
      {
        id: MONETIZATION.REMOVE_ADS_PRODUCT_ID,
        type: ProductType.NON_CONSUMABLE,
        platform: this.platform,
      },
    ]);

    store
      .when()
      .approved((t) => {
        void t.finish();
      })
      .finished(() => {
        void this.grant();
      });

    // This is the call that starts the (patched) native transaction observer.
    await store.initialize([this.platform]);

    const product = store.get(MONETIZATION.REMOVE_ADS_PRODUCT_ID, this.platform);
    this.price = product?.pricing?.price ?? "";
    if (product?.owned) await this.grant();
  }

  /** The single place the entitlement is granted. Awaits its own write. */
  private async grant(): Promise<void> {
    this.removed = true;
    await Storage.setAdsRemoved(true);
  }

  private async awaitEntitlement(ms: number): Promise<void> {
    const until = Date.now() + ms;
    while (!this.removed && Date.now() < until) await delay(200);
  }

  /** Purchase "remove ads". Resolves true once the entitlement is granted. */
  async purchaseRemoveAds(): Promise<boolean> {
    if (!this.native) {
      await this.grant(); // dev/web only
      return true;
    }
    try {
      await this.warmIap(); // first StoreKit touch happens here, on a deliberate tap
      const store = this.iap?.store;
      if (!store || !this.platform) return false;

      const offer = store.get(MONETIZATION.REMOVE_ADS_PRODUCT_ID, this.platform)?.getOffer();
      if (!offer) return false;

      const err = await store.order(offer);
      if (err) return false;

      // The entitlement is granted by the finished() handler; give it a beat.
      await this.awaitEntitlement(ENTITLEMENT_WAIT_MS);
      return this.removed;
    } catch {
      return false;
    }
  }

  /** Restore a previous "remove ads" purchase. Resolves true if entitled. */
  async restore(): Promise<boolean> {
    if (this.native) {
      try {
        await this.warmIap(); // user tapped Restore — only now may StoreKit speak
        const store = this.iap?.store;
        if (store && this.platform) {
          await store.restorePurchases();
          const product = store.get(MONETIZATION.REMOVE_ADS_PRODUCT_ID, this.platform);
          if (product?.owned) await this.grant();
        }
      } catch {
        /* fall through to the local mirror */
      }
    }
    if (!this.removed) this.removed = await Storage.getAdsRemoved();
    return this.removed;
  }

  /** Localized store price, e.g. "REMOVE ADS — 0,99 €". Never a hardcoded literal. */
  removeAdsLabel(): string {
    return this.price ? `REMOVE ADS — ${this.price}` : "REMOVE ADS";
  }

  // --- public surface ---------------------------------------------------------

  /** Has the user paid to remove ads? */
  isRemoved(): boolean {
    return this.removed;
  }

  /** Should any ad surface be shown at all? */
  adsActive(): boolean {
    return MONETIZATION.ENABLED && this.ready && !this.removed;
  }

  setMuted(muted: boolean): void {
    if (!this.native || !MONETIZATION.ENABLED) return;
    // Queue behind init: setApplicationMuted before initialize() is unverified.
    void this.adsReady.then(() => AdMob.setApplicationMuted({ muted })).catch(() => {});
  }

  /**
   * Show a rewarded ad for a continue/revive. Resolves true only if the reward
   * fired, and only once the ad is DISMISSED — so the caller can navigate
   * without transitioning behind a full-screen ad.
   */
  async showRewarded(): Promise<boolean> {
    if (!this.native) {
      await delay(700); // dev/web: simulate the ad so the flow stays testable
      return true;
    }
    if (!MONETIZATION.ENABLED) return false;

    try {
      await this.adsReady;
      if (!this.canServeAds) return false;

      let rewarded = false;
      const rewardHandle = await addAdListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      });
      const waiter = await this.armWaiter(
        [RewardAdPluginEvents.Dismissed, RewardAdPluginEvents.FailedToShow],
        REWARD_DISMISS_TIMEOUT_MS
      );

      try {
        await AdMob.prepareRewardVideoAd(this.adOpts(adUnits().rewarded));
        const item = await AdMob.showRewardVideoAd();
        if (item && item.amount > 0) rewarded = true;
        await waiter.done;
      } finally {
        await waiter.cleanup();
        await rewardHandle.remove().catch(() => {});
      }
      return rewarded;
    } catch {
      return false;
    }
  }

  /** Show an interstitial, resolving only once it is dismissed. Never throws. */
  async showInterstitial(): Promise<void> {
    if (!this.native || !this.adsActive()) return;
    try {
      await this.adsReady;
      if (!this.canServeAds) return;

      const waiter = await this.armWaiter(
        [InterstitialAdPluginEvents.Dismissed, InterstitialAdPluginEvents.FailedToShow],
        INTERSTITIAL_DISMISS_TIMEOUT_MS
      );
      try {
        await AdMob.prepareInterstitial(this.adOpts(adUnits().interstitial));
        await AdMob.showInterstitial();
        await waiter.done;
      } finally {
        await waiter.cleanup();
      }
    } catch (e) {
      /* an ad must never block navigation */
    }
  }

  /** Every Nth finished run, and never twice inside INTERSTITIAL_MIN_GAP_MS. */
  async maybeInterstitial(): Promise<void> {
    if (!this.adsActive()) return;

    const n = (await Storage.getRunsSinceAd()) + 1;
    const due = n >= MONETIZATION.INTERSTITIAL_EVERY_N_RUNS;
    const cooled = Date.now() - this.lastInterstitialAt >= MONETIZATION.INTERSTITIAL_MIN_GAP_MS;

    if (!due || !cooled) {
      await Storage.setRunsSinceAd(n); // keep counting; try again next run
      return;
    }

    await Storage.setRunsSinceAd(0);
    this.lastInterstitialAt = Date.now();
    await this.showInterstitial();
  }

  // --- internals -------------------------------------------------------------

  /**
   * The ONLY place ad options are built, so `npa` can never be forgotten.
   *
   * `isTesting` is always false on purpose. The plugin's `getAdId()` throws away
   * the caller's `adId` whenever `isTesting` is true and substitutes its own
   * hardcoded demo unit — so it would silently ignore the ids in adUnits.ts.
   * Test vs live is decided there instead, by USE_TEST_AD_UNITS.
   */
  private adOpts(adId: string): { adId: string; isTesting: boolean; npa: boolean } {
    return { adId, isTesting: false, npa: this.npa };
  }

  /**
   * Attach listeners BEFORE the ad is shown, so a fast Dismissed can't be missed.
   * The timeout exists only to un-wedge a broken SDK.
   */
  private async armWaiter(
    events: readonly string[],
    timeoutMs: number
  ): Promise<{ done: Promise<void>; cleanup: () => Promise<void> }> {
    let settle!: () => void;
    const done = new Promise<void>((r) => (settle = r));
    const timer = setTimeout(() => settle(), timeoutMs);

    const handles = await Promise.all(events.map((e) => addAdListener(e, () => settle())));

    const cleanup = async (): Promise<void> => {
      clearTimeout(timer);
      await Promise.all(handles.map((h) => h.remove().catch(() => {})));
    };
    return { done, cleanup };
  }
}

export const Monetization = new MonetizationService();
