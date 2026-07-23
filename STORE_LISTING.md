# Quadshot — Store Listing

Draft copy for the App Store and Google Play listings. Tune wording per store.

## App identity

- **Name (iOS, ≤30):** `Quadshot: Reflex Arcade` — 23 chars
- **Subtitle (iOS, ≤30):** `Reaction & fast tap game` — 24 chars
- **Title (Play, ≤30):** `Quadshot: Reflex Arcade`
- **Short description (Play, ≤80):** `Tap fast, match the falling symbols, and survive rules that keep flipping.` — 73 chars
- **Bundle / Application ID:** `com.bysubotic.quadshot`
- **Category:** Games → Arcade (secondary: Action)
- **Price:** Free
- **Age rating:** 4+ / Everyone (no objectionable content, no data collection)

## ASO — keyword strategy

The App Store indexes **name + subtitle + keywords field** with equal weight, and
a term repeated across them is wasted space. So the three fields are kept
disjoint:

| Field | Carries |
| ----- | ------- |
| Name | quadshot, reflex, arcade |
| Subtitle | reaction, fast, tap, game |
| Keywords | everything else, below |

**Keywords field (iOS, ≤100 chars — no spaces after commas, no plurals, nothing
already used above):**

```
shooter,shape,match,color,combo,streak,endless,twitch,speed,skill,timing,focus,casual,neon,offline
```

_98 chars._ Singulars cover plurals; Apple already indexes the developer name and
the category, so neither is repeated. `offline` and `casual` earn their slots —
both are high-volume browse terms in this genre.

Google Play ignores a keyword field and ranks on the **full description**
instead, so the long copy below works "reflex", "reaction", "arcade", "tap" and
"combo" in naturally rather than stuffing them.

## Promo text (iOS, ≤170 chars)

_Editable any time without a review — keep the current hook here._

Slide, aim, fire. Then the rules start swapping under you: cross kills square,
both pairs flip, three symbols rotate. How long does your muscle memory hold?

## Description

Quadshot is a fast, minimal reflex arcade game.

Symbols fall from the top. A row of four glowing pads wraps around the bottom of
the screen — slide it, line up the matching pad, and fire straight up to destroy
each symbol before it crosses the line. Miss three and it's over.

Nine escalating phases keep changing the rules and the speed:
• MATCH THE SHAPE — hit each symbol with its own pad
• MATCH THE COLOR — the shape is a decoy; match by colour instead
• CROSS-MATCH — two symbols trade places: fire cross to kill square
• DOUBLE CROSS — now both pairs are swapped; nothing hits its own
• TRIPLE CROSS — three symbols rotate, and only one still plays fair
…each played slow, then faster, then fastest.

The muscle memory you build in phase 1 is the thing working against you by
phase 9. Can you rewire it fast enough?

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

- **Privacy policy URL:** <https://dsuboticgreco.github.io/quadshot/privacy.html>
- **Support URL:** <https://dsuboticgreco.github.io/quadshot/> (email: subotic.djo@gmail.com)
- **Marketing URL:** <https://dsuboticgreco.github.io/quadshot/> — this one is
  load-bearing beyond marketing: AdMob crawls its **host** for `app-ads.txt`
  before it will fully serve ads. See the app-ads.txt section in `SUBMIT.md`.

All three are checked into `fastlane/metadata/en-US/` so a `fastlane release`
pushes them with the build.

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
