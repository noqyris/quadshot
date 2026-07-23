# App Store metadata (fastlane `deliver`)

These files are the source of truth for the listing text. `STORE_LISTING.md`
explains the ASO reasoning behind them; this directory is what actually ships.

**Only `fastlane release` uploads them.** `fastlane beta` (TestFlight) touches
nothing here — it uploads a binary and stops. So editing these files is safe at
any time; they reach App Store Connect only on a release run, and `force: true`
in the Fastfile means the upload happens without an interactive diff preview.

| File | App Store Connect field | Limit |
| ---- | ----------------------- | ----- |
| `name.txt` | App name | 30 |
| `subtitle.txt` | Subtitle | 30 |
| `keywords.txt` | Keywords (comma-separated, no spaces) | 100 |
| `description.txt` | Description | 4000 |
| `promotional_text.txt` | Promotional text (editable without review) | 170 |
| `release_notes.txt` | What's New in This Version | 4000 |
| `marketing_url.txt` | Marketing URL — **AdMob crawls this host for `app-ads.txt`** | — |
| `support_url.txt` | Support URL | — |
| `privacy_url.txt` | Privacy Policy URL | — |

Screenshots are NOT wired up here: `deliver` would expect them under
`fastlane/screenshots/`, and the ready-made sets live in `store-assets/` and are
uploaded by hand. See `store-assets/README.md` for the slot mapping.
