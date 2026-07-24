# Quadshot — App Store submission

## What's already done (in this repo)
- ✅ Portrait-only iOS app, bundle `com.bysubotic.quadshot`, v1.0 (build 1)
- ✅ 1024×1024 app icon, `ITSAppUsesNonExemptEncryption=false` (no export-compliance prompt)
- ✅ `DEV.ENABLED=false`, monetization off — clean release build
- ✅ App Store screenshots (6.9″, 1320×2868) in `scratchpad/appstore/` — menu, gameplay, rule card, game over
- ✅ `fastlane/` set up for automated build → upload (TestFlight + App Store review)

## What ONLY you can do (hard Apple gates — no tool/MCP bypasses these)
1. **Apple Developer Program** enrollment ($99/yr). Required to ship anything.
2. **App Store Connect API key** (so fastlane can upload without your password/2FA):
   App Store Connect → *Users and Access* → *Integrations* → *App Store Connect API* →
   generate a key with **App Manager** role → download `AuthKey_XXXX.p8` (once!),
   note the **Key ID** and **Issuer ID**.
3. **Team ID**: developer.apple.com → *Membership* → Team ID (10 chars).
4. **Create the app record** once: App Store Connect → Apps → **+** → New App
   (name "Quadshot", bundle `com.bysubotic.quadshot`, primary language, SKU).
5. **First code-signing setup**: open `ios/App/App.xcworkspace` in Xcode once,
   select your Team under *Signing & Capabilities* (automatic), then archive once
   (Product → Archive → Distribute) — this creates your distribution certificate.
   After that fastlane handles everything.
6. **App metadata & privacy** in App Store Connect: description, keywords, subtitle,
   support URL, **privacy policy URL** (host `PRIVACY.md` somewhere public),
   age rating, category (Games → Arcade / Action). Draft copy is in `STORE_LISTING.md`.
7. **Submit for review** and wait for Apple (usually 1–3 days).

## Then the automated path (once creds exist)
```bash
cp .env.appstore.example .env.appstore   # fill in the 6 values
set -a; source .env.appstore; set +a
fastlane beta       # → TestFlight (recommended first)
fastlane release    # → uploads + submits for App Store review
```
`fastlane build_ipa` runs `npm run build && npx cap sync ios`, bumps the build
number, and archives a signed app-store build. `beta`/`release` add the upload.

## AdMob app readiness review (`app-ads.txt`)

Since January 2025 AdMob will not let a newly registered app **fully serve ads**
until two things happen: the app is verified with an `app-ads.txt` file, and it
passes AdMob's *app readiness* review. Until then you get limited/no fill —
which looks exactly like "my ads don't work".

The file itself is one line and already lives in this repo at
[`public/app-ads.txt`](public/app-ads.txt) (Vite copies `public/` to the site
root, so any host that serves the web build also serves it):

```
google.com, pub-3307486877162157, DIRECT, f08c47fec0942fa0
```

**The catch: AdMob only crawls the _hostname_ of the developer website in your
store listing, at the domain root.** A URL like `.../quadshot/privacy.html`
still sends the crawler to `https://<host>/app-ads.txt` — a project-repo
subfolder is never consulted. On GitHub Pages that root path is only servable
from the **user-site repo**.

Status: **done.** `noqyris/noqyris.github.io` serves
<https://noqyris.github.io/app-ads.txt> (HTTP 200, verified), and the Quadshot
privacy page lives on the same host at `/quadshot/privacy.html`. All three
listing URLs point at that one host, so the crawl chain resolves.

Steps, in order:
1. Publish the line above at `https://<your-domain>/app-ads.txt` — plain text,
   HTTP 200, no redirect to a different host. Verify in a browser.
2. App Store Connect → your app → **Marketing URL** = a URL on that same host
   (App Information / version metadata). This is the field AdMob reads.
3. AdMob → *Apps* → Quadshot → *App settings* → **app-ads.txt** → *Check for
   updates*. Crawling and listing changes each take up to 24 h.
4. Once verified, AdMob runs the app readiness review automatically. Watch
   *Apps → Quadshot* for "Ready" / any policy flags.

Already satisfied on the app side (no action needed): `GADApplicationIdentifier`
in `Info.plist`, the full SKAdNetwork id list, `NSUserTrackingUsageDescription`
plus the ATT prompt, UMP/GDPR consent flow in `Monetization.ts`, and
`PrivacyInfo.xcprivacy`.

## Notes
- **Privacy:** the app is currently 100% offline / no tracking → "Data Not Collected"
  on the App Privacy form. (If you add the Supabase global leaderboard later, that
  changes — see the leaderboard plan.)
- The screenshots are clean in-engine captures at the right size; you may want
  polished marketing frames/captions later, but these are valid to submit as-is.
