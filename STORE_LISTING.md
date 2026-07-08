# Quadshot — Store Listing

Draft copy for the App Store and Google Play listings. Tune wording per store.

## App identity

- **Name:** Quadshot
- **Subtitle (iOS, ≤30 chars):** One more run. One thumb.  _(alt, keyword-rich: "Fast neon reflex arcade")_
- **Short description (Play, ≤80 chars):** Slide, aim, fire. Match the falling symbols before they hit the floor.
- **Bundle / Application ID:** `com.bysubotic.quadshot`
- **Category:** Games → Arcade / Action
- **Price:** Free
- **Age rating:** 4+ / Everyone (no objectionable content, no data collection)

## Promo text (iOS, ≤170 chars)

Slide, aim, fire. Chain combos for huge multipliers, smash your high score, then
dare your friends: can you beat me? Endless neon reflex arcade.

## Description

Quadshot is a fast, minimal reflex arcade game.

Symbols fall from the top. A row of four glowing pads wraps around the bottom of
the screen — slide it, line up the matching pad, and fire straight up to destroy
each symbol before it crosses the line. Miss three and it's over.

Nine escalating phases keep changing the rules and the speed:
• MATCH THE SHAPE — hit each symbol with its own pad
• MATCH THE COLOR — the shape is a decoy; match by colour instead
• CROSS-MATCH — each symbol destroys the next in the ring
…each played slow, then faster, then fastest.

Features:
• One-thumb controls — slide to aim, tap to fire
• Endless run with combo multipliers and streak rewards
• Local high scores and lifetime stats
• Haptic feedback and punchy neon juice
• No accounts, no sign-up — open it and play
• Watch an ad to continue a run, or remove ads with a one-time purchase

Keywords (iOS, comma-separated, ≤100 chars):
`reflex,arcade,combo,endless,neon,fast,twitch,one more run,high score,tap,streak,challenge,score`

## Screenshots — DONE (see `store-assets/`)

Generated framed marketing screenshots at **1320×2868 (iPhone 6.9")**, captioned,
ordered as a story. Reuse the same set for Google Play phone screenshots.

1. `screenshot-01-title.png` — "FOUR PADS. ONE THUMB."
2. `screenshot-02-shape.png` — "SLIDE. AIM. FIRE."
3. `screenshot-03-color.png` — "DON'T TRUST THE SHAPE"
4. `screenshot-04-cross.png` — "REWIRE YOUR REFLEXES"
5. `screenshot-05-combo.png` — "CHAIN IT, 5X IT"
6. `screenshot-06-share.png` — "CAN YOU BEAT ME?"

**iPad 12.9"/13" set** (required — iPad is supported): `screenshot-ipad-01..06-*.png`
at 2048×2732 (portrait game in a centred device frame on a branded background).

Other store images in `store-assets/`: `app-icon-1024.png` (iOS, no alpha),
`play-icon-512.png` (Play, 32-bit), `feature-graphic-1024x500.png` (Play).
Mapping + upload slots: `store-assets/README.md`.

Feature-graphic tagline: **"Chain combos. Beat your friends."**

## Required links

- **Privacy policy URL:** host `PRIVACY.md` (e.g. GitHub Pages) and link it.
- **Support URL / email:** subotic.djo@gmail.com

## Virality — share loop (built)

The core viral mechanic ships: on Game Over a prominent **SHARE ↗** button
generates a branded square **score card** (`src/ui/ShareCard.ts`) and opens the
native share sheet (`@capacitor/share`, image written via `@capacitor/filesystem`;
Web Share API + download/clipboard fallback on web) with the message
*"I scored N in QUADSHOT 🎮 … Can you beat me? <link>"*.

**MUST DO for it to drive installs:** set `SHARE.URL` in
[`src/config/constants.ts`](src/config/constants.ts) to your real **App Store /
Play / landing link** (currently a placeholder). The shared card + "beat me"
challenge only converts if the link leads somewhere installable.

Other viral levers (mostly marketing, on you):
- A 10–15s gameplay clip for TikTok/Reels/Shorts (the neon combos screenshot well).
- ASO: the icon, keywords and screenshots above; localise the title/subtitle.
- A global leaderboard (Game Center / Play Games) for "beat the world" — see below.
- Optional next steps in-app: daily streak, achievements, a "challenge" deep link.

## ⚠️ Pre-submission note — trademark risk

The current pad symbols (triangle / circle / cross / square) and their
colours (green / red / blue / pink) closely resemble Sony's PlayStation
controller face buttons, which are **registered trademarks**. Shipping them as-is
risks App Store / Play rejection or a trademark complaint.

Before submitting, consider switching to an original symbol/colour set. The code
is built for this: `Sym`, `COLORS`, and the shape textures in
`src/config/constants.ts` + `src/scenes/BootScene.ts` are the only places to
change, and the match engine is colour/shape-agnostic.

## Monetization (LIVE from v1.1.0)

**v1.1.0 ships AdMob (rewarded + interstitial) and a Remove-Ads IAP** — `MONETIZATION.ENABLED=true`,
AdMob (rewarded + interstitial) is wired, and the listing/privacy copy discloses
ads, ATT and the Remove-Ads purchase. To turn ads off again, flip the flag back off
and wire the native SDKs as below (then re-add `INTERNET` and update the privacy copy).

The game-side flows are built and working behind safe fallbacks in
`src/systems/Monetization.ts` (rewarded "continue", a capped interstitial; no banner ships,
and a "Remove Ads — $0.99" entitlement persisted locally). To make them real:

**Ads — AdMob** (`@capacitor-community/admob`):
1. Create an AdMob app; get the **App ID** + **rewarded** and **banner** ad-unit IDs.
2. iOS: add `GADApplicationIdentifier` + `SKAdNetworkItems` to `Info.plist`.
   Android: add the App ID `<meta-data>` to `AndroidManifest.xml`.
3. In `Monetization.ts`, replace the `showRewarded()` fallback with load+show of a
   rewarded ad (resolve `true` only on the reward callback). Show/hide the AdMob
   banner where `Banner.ts` draws its placeholder (menu / game-over only, so it
   never covers the launcher). Use Google **test ad unit IDs** during development.

**Remove-ads IAP** ($0.99 non-consumable):
1. Create the product in App Store Connect + Play Console (e.g. `quadshot.remove_ads`).
2. Wire a billing plugin (StoreKit / Play Billing) into `purchaseRemoveAds()` and
   `restore()`; only grant on a **verified** receipt, and call `restore()` on launch
   so the entitlement survives reinstalls.

Until wired, the fallbacks grant locally so the UX is fully testable.

## Online leaderboard (future)

Local high scores ship now. A global leaderboard (Apple Game Center / Google
Play Games) needs a community Capacitor plugin plus App Store Connect / Play
Console config and signed builds on real devices — a dedicated step before launch.
