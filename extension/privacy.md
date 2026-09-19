# Privacy contract

We Hate Scammers (browser extension) flags scam **patterns** on-device. It is a filter engine, not a chat scraper.

## Allowed in `chrome.storage`

| Key | Meaning |
| --- | --- |
| `enabled` | Master kill switch |
| `sitesEnabled` | Per-site kill switches (`linkedin`, `facebook`, `instagram`) |
| `rulesVersion` | Integer from `rules/rules.json` |
| `warningsShown` | Counter only |
| `userDisabledRuleIds` | Optional list of rule ids the user muted |

Nothing else is written.

## Forbidden

- Message bodies
- Matched snippets
- Full URLs of DMs
- Any `fetch` of page text to a server
- Uploading scan buffers
- Cloud analysis

Scan buffers live in local variables, then are discarded. The UI receives `{ score, matchedRuleIds, topScamId, reasons[] }` only. The banner never paints the user’s message.

Badge counts and “warnings shown” are numbers. Dismiss-suppression is in-memory on the tab (minutes), not stored text.

## Fail open

If the master toggle or a site toggle is off, the content script does not attach a `MutationObserver`. Pages keep working.

## Network

v1 does not call We Hate Scammers APIs. Opening the questionnaire is a normal navigation the user starts from a button.
