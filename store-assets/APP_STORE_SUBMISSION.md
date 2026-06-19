# Quadshot — App Store submission (copy-paste sheet)

You have an Apple Developer account, so signing is the only manual gate. Verified:
device (arm64) Release **compiles clean**, signing is **Automatic**, bundle id
`com.bysubotic.quadshot`, version **1.0 (1)**. Follow the steps; paste the fields.

---

## 1. Xcode (your Mac) — archive + upload
1. Open `ios/App/App.xcworkspace`.
2. Select the **App** target → **Signing & Capabilities** → tick **Automatically
   manage signing** → choose your **Team**. (Bundle id stays `com.bysubotic.quadshot`;
   Xcode registers the App ID on first archive.)
3. **Add the privacy manifest to the target** (one-time): in the Project navigator
   drag `App/PrivacyInfo.xcprivacy` into the **App** group, and in the dialog tick the
   **App** target. Confirm it shows under **Build Phases → Copy Bundle Resources**.
   (Without this you get an ITMS-91053 warning email after upload.)
4. Top bar: set destination to **Any iOS Device (arm64)**.
5. **Product → Archive** → in the Organizer, **Distribute App → App Store Connect →
   Upload**. Wait for the “processed” email (a few minutes).

## 2. App Store Connect — create the app
- **+ New App** → iOS → Name **Quadshot** (if taken, use e.g. “Quadshot: Neon Reflex”)
  → Primary language English (U.S.) → Bundle ID `com.bysubotic.quadshot` → SKU `quadshot`.

## 3. App Store Connect — paste these fields

**Subtitle** (≤30): `One more run. One thumb.`

**Promotional Text** (≤170):
```
Slide, aim, fire. Chain combos for huge multipliers, smash your high score, then dare your friends: can you beat me? Endless neon. 100% offline.
```

**Keywords** (≤100, comma-separated):
```
reflex,arcade,combo,endless,neon,fast,twitch,one more run,high score,tap,streak,challenge,score
```

**Description:**
```
Quadshot is a fast, minimal reflex arcade game.

Symbols fall from the top. A row of four glowing pads wraps around the bottom of the screen — slide it, line up the matching pad, and fire straight up to destroy each symbol before it crosses the line. Miss three and it's over.

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
• 100% offline — no ads, no accounts, no tracking
```

**Category:** Primary **Games → Arcade**, Secondary **Games → Action**
**Copyright:** `2026 Djordje Subotic`
**Price:** Free
**Support URL:** _(required — see §5; e.g. your hosted privacy page's site root)_
**Marketing URL:** optional
**Version / What's New:** `1.0` — `First release.`

## 4. Screenshots (drag from `store-assets/`)
- **iPhone 6.9" Display:** `screenshot-01-title.png` … `screenshot-06-share.png`
- **iPad 13" Display:** `screenshot-ipad-01-title.png` … `screenshot-ipad-06-share.png`
  (iPad is required because the app supports iPad.)

## 5. Privacy policy URL (required) — host `privacy.html`
Quickest with this repo on GitHub:
1. Push the repo to GitHub, copy `store-assets/privacy.html` to `docs/index.html`.
2. Repo **Settings → Pages → Source: main /docs** → you get
   `https://<your-gh-user>.github.io/<repo>/`.
3. Put that URL in **App Privacy → Privacy Policy URL** (and reuse the site root as
   the **Support URL**). Any HTTPS host works — it doesn't have to be GitHub.

## 6. App Privacy + Age Rating (in App Store Connect)
- **App Privacy → Data Collection: “Data Not Collected.”** (No data types — the app
  is fully offline. The `PrivacyInfo.xcprivacy` already declares the required-reason
  APIs, so no extra prompts.)
- **Age Rating questionnaire:** answer **None** to everything → results in **4+**.
- **Export compliance:** no prompt — `ITSAppUsesNonExemptEncryption=false` is set.

## 7. Submit
Select the processed build → **Add for Review → Submit**. Review is typically ~24h.

---

### After approval (nice-to-have)
- Set `SHARE.URL` in `src/config/constants.ts` to your real App Store link
  (`https://apps.apple.com/app/idXXXXXXXX`), rebuild + `npx cap copy`, ship in 1.0.1 —
  so the share-card “Can you beat me?” link opens the store.
- Trademark note: the triangle/circle/cross/square set resembles PlayStation buttons —
  you've accepted this risk; if rejected on those grounds, swap `COLORS`/shapes (the
  match engine is shape/colour-agnostic).
