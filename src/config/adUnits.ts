import { Capacitor } from "@capacitor/core";

/**
 * AdMob ad unit ids, per platform.
 *
 * The TEST ids are Google's own demo units, copied verbatim from
 *   https://developers.google.com/admob/ios/test-ads
 *   https://developers.google.com/admob/android/test-ads
 * They always fill and never count as impressions. Requesting REAL ad units from
 * a development build is a policy violation, so `USE_TEST_AD_UNITS` is the single
 * switch that decides which set is live.
 *
 * Do NOT reach for the plugin's `isTesting: true` option to get test ads:
 * `AdMobPlugin.getAdId()` DISCARDS the caller's `adId` when `isTesting` is set and
 * substitutes its own hardcoded demo id. We choose the id here instead, and always
 * pass `isTesting: false` — see Monetization.adOpts().
 *
 * NOTE the two id shapes: an APP id uses `~`, an AD UNIT id uses `/`. The app id
 * lives in ios/App/App/Info.plist (GADApplicationIdentifier) and
 * android/app/src/main/res/values/strings.xml (admob_app_id), not here.
 */

/** Flip to true when developing against a real device to keep serving test ads. */
export const USE_TEST_AD_UNITS = false;

interface AdUnits {
  interstitial: string;
  rewarded: string;
}

const IOS_TEST: AdUnits = {
  interstitial: "ca-app-pub-3940256099942544/4411468910",
  rewarded: "ca-app-pub-3940256099942544/1712485313",
};

const ANDROID_TEST: AdUnits = {
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
};

/** Quadshot, AdMob app `ca-app-pub-3307486877162157~4900552009` (store id 6786440884). */
const IOS_LIVE: AdUnits = {
  interstitial: "ca-app-pub-3307486877162157/1021016744", // "Quadshot Interstitial Game Over"
  rewarded: "ca-app-pub-3307486877162157/1191195684", //     "Quadshot Rewarded Continue"
};

// Android has no AdMob app yet — iOS ships first. Empty ids make prepare*() reject,
// which Monetization treats as "no ad available", so nothing breaks.
const ANDROID_LIVE: AdUnits = { interstitial: "", rewarded: "" };

const isAndroid = (): boolean => Capacitor.getPlatform() === "android";

/** Resolved lazily: Capacitor.getPlatform() is only meaningful after boot. */
export function adUnits(): AdUnits {
  if (USE_TEST_AD_UNITS) return isAndroid() ? ANDROID_TEST : IOS_TEST;
  return isAndroid() ? ANDROID_LIVE : IOS_LIVE;
}
