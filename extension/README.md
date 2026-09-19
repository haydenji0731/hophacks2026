# We Hate Scammers — Chrome extension

On-device scam pattern flagging for LinkedIn, Facebook, and Instagram. Inspired by uBlock: cheap checks first, compiled lists, silent defaults.

This folder is the stretch Chrome client for [We Hate Scammers](https://github.com/haydenji0731/hophacks2026). It does **not** replace the phone detector or the website questionnaire. It deep-links to `https://wehatescammers.com/questionnaire?hint={topScamId}`.

## What it does

- Scores visible conversation/feed text against a compiled token/phrase list
- Checks new `a[href]` hostnames against a small suspicious-host set
- Badge on a soft hit; one banner on a hard hit
- Never stores or uploads message bodies

## What it does not do (v1)

ML models, bundlers, `<all_urls>`, cloud analysis, full-site scrapers, declarativeNetRequest.

## Architecture

```
L0  master + per-site toggles     if off → no MutationObserver
L1  hostname Set on a[href]       O(1) per link
L2  observe site root only        debounce 300ms
L3  compiled Map + short phrases  tokenize ≤ 3k chars
L4  badge (soft) → banner (hard)  never echo the user's text
```

```
rules.json ──compileRules.js──► { tokenMap, phrases, combos }
                                      │
page text ──scan.js (debounce/hash)──► score.js (pure)
                                      │
                               { score, reasons, topScamId }
                                      │
                               ui.js + background badge
```

`score.js` has no DOM. Node can test it without Chrome.

## Load unpacked

1. Chrome → `chrome://extensions` → Developer mode
2. **Load unpacked** → this `extension/` directory
3. Pin the action. Master + site toggles are in the popup
4. Open **Open test fixture**, or run the local fixture server below

## Test

```bash
# Pure engine (no browser)
node extension/scripts/test-score.mjs

# Validate the seeded list
node extension/scripts/build-rules.mjs

# Serve fixtures + popup for a browser pass
node extension/scripts/serve-fixtures.mjs
# http://127.0.0.1:43177/testdata/fixtures.html
```

### Done-criteria checks

| Check | How |
| --- | --- |
| Node score tests pass | `node extension/scripts/test-score.mjs` |
| Fixture hits and misses | Open `testdata/fixtures.html` (popup or served) |
| No message text in storage | After a banner, inspect `chrome.storage.local` — only toggles / counters / version |
| Disabled site = zero observer work | Turn off a site in the popup; content script disconnects |
| Badge soft / banner hard | Birthday gift-card line stays under hard; IRS + gift cards banners |
| False-positive pass | “I got you a gift card for your birthday” scores 3 |

## Privacy

See [privacy.md](privacy.md). Allowed storage keys: `enabled`, `sitesEnabled`, `rulesVersion`, `warningsShown`, `userDisabledRuleIds`. Forbidden: message bodies, matched snippets, DM URLs, any fetch of page text.

## Rules

`rules/rules.json` is a filter list. Scanner code should rarely change. Seeded from the HopHacks detector wake phrases, labeled transcripts, questionnaire scam types, and high-frequency encyclopedia patterns. Reference: [rules/KEYWORD_REFERENCE.md](rules/KEYWORD_REFERENCE.md).

## Permissions

`storage` only. Host permissions are LinkedIn, Facebook/Messenger, and Instagram. Localhost matches exist so the served fixture can exercise the content script.

## Layout

```
extension/
  manifest.json
  README.md
  privacy.md
  rules/
  src/background.js
  src/shared/          # constants, compileRules, score (pure)
  src/content/         # L0–L4 + thin site roots
  src/popup/
  testdata/
  scripts/
```
