# Sherpa scorer

Offline scorer used by the Sherpa Chrome extension for short social-media text (Discord DMs, ad copy, email snippets, link-preview text). It returns a 0–100 suspicion score, a band (`ok` / `caution` / `high`), up to three plain-language reasons, and highlight spans.

No network. No “this is definitely a scam” claims — only suspicious / high-risk signals.

## Use

```ts
import { analyze } from "./src";

const result = analyze("IRS: pay overdue tax with Apple gift cards today");
// { score, band, reasons, highlights, category }
```

In the Chrome extension the same `analyze()` call runs inside `scorer.js`.

## Layout

| Path | Role |
| --- | --- |
| `data/cues.json` | Weighted cue phrases by family |
| `data/associations.json` | Soft links between cues (`gift_card` ↔ `itunes`) |
| `data/combos.json` | Cross-family bonuses (the between-the-lines layer) |
| `data/benign.json` | Known-safe mail that should not go red |
| `src/` | Pure functions: normalize → match → associate → combos → calibrate |
| `tests/fixtures.json` | Labeled examples; add one when you add a cue |

## Extend without touching code

1. Add a cue to `data/cues.json` (`id`, `family`, `patterns`, `weight` 1–10).
2. Optional: add an edge in `data/associations.json` (`a`, `b`, `strength` 0–1).
3. Optional: add a combo rule in `data/combos.json`.
4. Add a fixture in `tests/fixtures.json` with `expectedBand`.
5. Run `npm test` and `npm run build` so the extension bundle picks up the data.

Patterns are literal phrases unless they start with `re:`, then they are a case-insensitive regex.

Families: `urgency`, `reward`, `payment`, `credential`, `authority`, `secrecy`, `action`, `job_romance_ops`.

## Bands

| Score | Band | Highlight |
| --- | --- | --- |
| 0–24 | ok | none |
| 25–54 | caution | yellow |
| 55–100 | high | red |

The curve is tuned to **prefer false positives** over missed scams.
