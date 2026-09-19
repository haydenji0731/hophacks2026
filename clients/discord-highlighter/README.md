# Discord Scam Smell

Chrome extension that watches Discord locally and highlights **suspicious** user messages. Normal chat stays untouched. Caution is yellow, high risk is red. Hover a highlight for a short explanation.

Nothing is sent off your machine. This is a warning, not a verdict.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open [discord.com](https://discord.com) in Chrome

If it is already loaded, click **Reload** after pulling changes.

## What it flags

Offline cue matching + a small association graph + cross-family combos (urgency + payment, authority + credentials, and similar). See [`scam-smell/README.md`](scam-smell/README.md) to add cues in JSON only.

| Band | Score | Highlight |
| --- | --- | --- |
| ok | 0–24 | none |
| caution | 25–54 | yellow |
| high | 55–100 | red |

Avatars and the message row are never painted. Date separators and most system events are ignored.

It matches Discord stable, PTB, and Canary, and keeps watching as you switch DMs or channels.

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
| `content.js` | MutationObserver, highlights, popup |
| `content.css` | Yellow / red highlighter + popup |
| `scam-smell/` | Source, data, and fixtures |
