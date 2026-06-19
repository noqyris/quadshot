# Quadshot — Store Submission Assets

All images are generated and store-compliant (dimensions + alpha verified). Marketing
copy lives in [`../STORE_LISTING.md`](../STORE_LISTING.md). Captions are already burned
into the screenshots.

## Files → where they go

### Apple App Store Connect

| File | Spec | Where to use |
|---|---|---|
| `app-icon-1024.png` | 1024×1024, **no alpha**, RGB | App marketing icon. Drop into the Xcode **AppIcon** asset catalog (1024 slot) — since Xcode 14 it ships inside the build; App Store Connect reads it from there. |
| `screenshot-01-title.png` … `screenshot-06-share.png` | 1320×2868, no alpha | **iPhone 6.9" Display** screenshots (App Store Connect → your app → version → Previews and Screenshots → 6.9"). Upload 2–10; these 6 are ordered as a story. The 6.9" set also covers 6.5"/6.7" in the current flow. |
| `screenshot-ipad-01-title.png` … `screenshot-ipad-06-share.png` | 2048×2732, no alpha | **iPad 12.9"/13" Display** screenshots (required because the app supports iPad). The portrait game sits in a centred device frame on a branded background (the field letterboxes on iPad, so this is intentional). |

### Google Play Console (Main store listing)

| File | Spec | Where to use |
|---|---|---|
| `play-icon-512.png` | 512×512, 32-bit PNG (alpha kept) | **App icon**. |
| `feature-graphic-1024x500.png` | 1024×500, **no alpha** | **Feature graphic** (required). |
| `screenshot-01..06-*.png` | 1320×2868 (within 320–3840, portrait) | **Phone screenshots** (2–8). Reuse the same 6. |

## Screenshot order / captions
1. **title** — "FOUR PADS. ONE THUMB." · Fast neon reflex arcade. Try to stop.
2. **shape** — "SLIDE. AIM. FIRE." · Hit every symbol with its own pad.
3. **color** — "DON'T TRUST THE SHAPE" · Shape's a decoy. Match the colour.
4. **cross** — "REWIRE YOUR REFLEXES" · Cross-match: each symbol kills the next.
5. **combo** — "CHAIN IT, 5X IT" · Streaks stack multipliers fast.
6. **share** — "CAN YOU BEAT ME?" · Share your score. Dare your friends.

## Notes
- `raw/` holds the unframed full-bleed gameplay captures (1320×2868) used to build the
  framed screenshots — kept in case you want to recompose or use them bare.
- These are **marketing** assets. The in-app launcher icon (`ios/.../AppIcon.appiconset`,
  Android adaptive icon) is separate — see STORE_LISTING.md if you want it re-skinned to
  match `app-icon-1024.png` (iOS is a drop-in; Android needs a centre-safe variant because
  the adaptive mask crops the corners where the symbols sit).
- Regenerate everything with `/tmp/qs-assets.mjs` (Chrome CDP renderer) — needs
  `npm run preview` + headless Chrome on :9222, then `node --experimental-websocket`.
- Trademark reminder: the triangle/circle/cross/square set resembles PlayStation face
  buttons. Confirm you're OK with that risk before submitting (see STORE_LISTING.md).
