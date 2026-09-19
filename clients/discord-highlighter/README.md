# Scam Smell

Chrome extension that watches **Discord**, **Instagram**, and **Reddit** locally and highlights **suspicious** user text. Normal chat stays untouched. Caution is a muted yellow, high risk is a muted red, both translucent so the message stays readable. Hover a highlight for a short explanation. High-risk popups say **DO NOT CLICK**; caution says **BE CAREFUL BEFORE CLICKING THIS**. The popup flips above the text when it would clip off the bottom of the screen.

Nothing is sent off your machine. This is a warning, not a verdict.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open Discord, Instagram (including DMs), or Reddit

If it is already loaded, click **Reload** after pulling changes.

## What it flags

Offline cue matching + a small association graph + cross-family combos (urgency + payment, authority + credentials, and similar). See [`scam-smell/README.md`](scam-smell/README.md) to add cues in JSON only.

| Band | Score | Highlight |
| --- | --- | --- |
| ok | 0–24 | none |
| caution | 25–54 | yellow |
| high | 55–100 | red |

Avatars, nav chrome, and composers are never painted.

| Site | Watched text |
| --- | --- |
| Discord | User messages (stable, PTB, Canary). Survives DM / channel switches. |
| Instagram | Direct messages, captions, and comments. Survives thread switches. |
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
| `content.js` | Site adapters, MutationObserver, highlights, popup |
| `content.css` | Yellow / red highlighter + popup |
| `scam-smell/` | Source, data, and fixtures |
