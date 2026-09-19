# Sherpa scorer

Offline scorer used by the Sherpa Chrome extension for short social-media text (Discord DMs, Docs/Slides comments, ad copy, email snippets, link-preview text). It returns a 0–100 suspicion score, a band (`ok` / `caution` / `high`), up to three plain-language reasons, and highlight spans.

No network. No “this is definitely a scam” claims — only suspicious / high-risk signals.

## How the score is built

Sherpa does **not** give every word a weight. It looks up **cues** (known phrases), then adds extra points when those cues **show up together**. That second step is the association layer — the one to edit if “gift card + IRS” should fire harder than “gift card” alone.

Pipeline, in order:

1. **Normalize** — strip zero-width characters, collapse spaces, lowercase, and fold leetspeak (`p@ssw0rd` → `password`). Keep a map back to the original string so highlights still line up.
2. **Tokenize** — split on `[a-z0-9]+` so “don’t tell” is two tokens. Associations measure distance in **tokens**, not characters.
3. **Match cues** (`data/cues.json`) — each cue has `id`, `family`, `patterns`, and `weight` 1–10. A pattern is a literal phrase unless it starts with `re:`, then it is a case-insensitive regex. Word-boundary `\b` is added around literals that start/end with a letter or digit.
4. **Negation** — if a cue is not `negation_safe`, a hit is dropped when `not` / `n't` / `never` / `no` / `without` appears in the **three tokens before** it. `"this is not a gift card"` will not score `gift_card`. `"pay with a gift card"` will.
5. **Cap repeats** — first hit of a cue id counts at 100%, the second at 40%, later ones at 12%. Spamming “urgent urgent urgent” barely moves the needle.
6. **Association boost** (`data/associations.json`) — see below.
7. **Family combos** (`data/combos.json`) — if every listed family appears anywhere in the message, add a flat `bonus` and that rule’s reason. Combos ignore distance. `authority` + `payment` is +15 even if the two hits are far apart.
8. **Structural extras** — shortened links, `discord.gift`-style URLs, “you have won” without a prior-relationship phrase, or a dollar amount next to an imperative (`pay`, `wire`, `click`…).
9. **Benign damper** (`data/benign.json`) — shipping receipts, “you requested a password reset”, and similar. If there is **no** payment or credential cue, raw score is `raw * 0.2 - benignWeight`. If those families *are* present, only a tiny subtract (`min(4, benign * 0.15)`), so “IRS gift cards” is not saved by the word “package”.
10. **Floor** — a lone credential or payment family is raised to raw 10 so “click to verify your account” cannot sit at zero.
11. **Calibrate** — piecewise curve onto 0–100, then band: **0–24 ok**, **25–54 caution**, **55–100 high**. The curve is steep in the middle so a couple of cooperating cues cross into yellow/red quickly.

`raw` before calibration is:

```
cueWeights (after repeat cap)
+ associationBoost
+ combo bonuses
+ structural extras
− benign damper
```

### Associations (the layer to improve)

An edge is `{ "a": "gift_card", "b": "irs", "strength": 0.95 }`. `a` and `b` are **cue ids**, not words.

When both ends hit, and at least one pair of those hits is within **40 tokens**, the boost is:

```
max(weight of a, weight of b) × strength
```

`gift_card` is weight 9, `irs` is 9, strength 0.95 → **+8.55** on top of the cue weights themselves.

**Family fallback:** if cue `a` is present but cue `b` is not, Sherpa will try to pair `a` with **any hit in `b`’s family** (and the other way around). So `gift_card` ↔ `irs` can also fire when the message has a gift card plus *any* authority cue (`fbi`, `microsoft_support`, …) within 40 tokens. If you want a pair to be exact-only, that is a code change — today the JSON cannot turn fallback off.

Each undirected pair is counted once (`gift_card|irs` is the same as `irs|gift_card`).

Distance is token index, not “same sentence”. A 40-token window is roughly a long paragraph.

### Worked example

`IRS: pay overdue tax with Apple gift cards today, don't tell anyone`

| Layer | What hits | Rough raw |
| --- | --- | --- |
| Cues | `irs` 9, `gift_card` 9, `itunes_card` 8, `dont_tell`  (secrecy), maybe `send_money`/`pay` | ~30+ |
| Associations | `gift_card`↔`itunes_card`, `gift_card`↔`irs`, `irs`↔`dont_tell` | + several × strength |
| Combos | `authority`+`payment` (+15), `payment`+`secrecy` (+12), … | +20s |
| Result | calibrates to **high** | red |

`hey are we still on for pizza later?` matches nothing → 0 → ok.

`Click to verify your account` is mostly `verify_account` + `action` + the credential floor → **caution**.

### How to add an association

1. Confirm both cue ids exist in `data/cues.json`. If the phrase is new, add the cue first (`id`, `family`, `patterns`, `weight` 1–10).
2. Add `{ "a": "id_one", "b": "id_two", "strength": 0.7–0.95 }` to `data/associations.json`. Strength 0.7 is a nudge; 0.95 is “these two almost never appear together in honest mail.”
3. If the smell is “this *kind* of ask plus that *kind* of ask” (urgency + payment) and distance should not matter, add a **combo** instead of an edge.
4. Add a fixture in `tests/fixtures.json` with `expectedBand`.
5. Run `npm test` and `npm run build`.

Families: `urgency`, `reward`, `payment`, `credential`, `authority`, `secrecy`, `action`, `job_romance_ops`.

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
