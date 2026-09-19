# Sherpa

Chrome extension that watches **Discord**, **Instagram**, and **Reddit** locally and highlights **suspicious** user text. Normal chat stays untouched. Credit is a muted yellow, high risk is a muted red, both translucent so the message stays readable.

Yellow highlights say **BE MINDFUL OF LINKS**. Red highlights say **DO NOT CLICK ANY LINKS.**

Nothing is sent off your machine. This is a warning, not a verdict.

## Aggressiveness

Open the toolbar popup and use the slider.

| Level | Also called | What it does |
| --- | --- | --- |
| **Point** (default) | Guide | Mark the text. Click a highlight to open the reason. No popups, no floating chips, no “are you sure?” on links. |
| **Warn** | Guard | Everything Point does. High-risk highlights and mismatched links ask **Continue / Go back** before they open. |
| **Block** | — | Links inside highlighted text always stop first and show the real destination. |

A mismatched link is one whose visible words do not match the site it actually opens (for example “paypal.com” pointing at `evil.example`).

**Show descriptions** is a checkbox in the same menu. Turn it off if you only want the highlight, with no reason panel.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open Discord, Instagram (including DMs), or Reddit

If it is already loaded, click **Reload** after pulling changes.

## Check that it works

1. Pin **Sherpa** from the Chrome puzzle-piece menu so the toolbar button stays visible.
2. Open Discord, Instagram, or Reddit.
3. Click the icon. It should say **Working on this tab**.
4. Set Point / Warn / Block and the descriptions checkbox. Those apply to the current tab immediately.
5. Click **Run a local self-test** — that scores a safe shipping note and a gift-card IRS line offline.

If it says it is not injected, reload the tab or reload the unpacked extension.

## What it flags

Offline cue matching + a small association graph + cross-family combos (urgency + payment, authority + credentials, and similar). See [`scam-smell/README.md`](scam-smell/README.md) to add cues in JSON only.

| Band | Score | Highlight |
| --- | --- | --- |
| ok | 0–24 | none |
| caution | 25–54 | yellow · BE MINDFUL OF LINKS |
| high | 55–100 | red · DO NOT CLICK ANY LINKS. |

Avatars, nav chrome, and composers are never painted.

| Site | Watched text |
| --- | --- |
| Discord | User messages (stable, PTB, Canary), including ones you just sent. Survives DM / channel switches. |
| Instagram | Direct messages, captions, and comments. Rebuilds word-split bubbles inside the DM form and paints only the text. |
| Reddit | Post bodies/titles and comments (new and old Reddit). |

## Develop

```bash
npm install
npm test
npm run build
```

`npm run build` writes `scorer.js` for the unpacked extension.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Manifest V3 |
| `scorer.js` | Bundled offline analyzer |
| `settings.js` | Point / Warn / Block + descriptions prefs |
| `content.js` | Site adapters, highlights, why panel, link gate |
| `popup.html` / `popup.js` | Toolbar: slider, descriptions, ping, self-test |
| `content.css` | Highlighter, why panel, confirm gate |
| `scam-smell/` | Source, data, and fixtures |
