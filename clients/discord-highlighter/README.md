# Scam Smell

Chrome extension that watches **Discord**, **Instagram**, and **Reddit** locally and highlights **suspicious** user text. Normal chat stays untouched. Caution is a muted yellow, high risk is a muted red, both translucent so the message stays readable. Hover a highlight for a short explanation. High-risk popups say **DO NOT CLICK**; caution says **BE CAREFUL BEFORE CLICKING THIS**. The popup flips above the text when it would clip off the bottom of the screen.

Nothing is sent off your machine. This is a warning, not a verdict.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open Discord, Instagram (including DMs), or Reddit

If it is already loaded, click **Reload** after pulling changes.

## Check that it works

1. Pin **Scam Smell** from the Chrome puzzle-piece menu so the toolbar button stays visible. Chrome will use its default extension glyph; click it the same way.
2. Open Discord, Instagram, or Reddit.
3. Click the icon. It should say **Working on this tab**.
4. Click **Run a local self-test** — that scores a safe shipping note and a gift-card IRS line offline. You do not need those sites for the self-test.

If it says it is not injected, reload the tab or reload the unpacked extension.

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
| `content.js` | Site adapters, MutationObserver, highlights, popup |
| `popup.html` / `popup.js` | Toolbar icon: ping this tab + local self-test |
| `content.css` | Yellow / red highlighter + popup |
| `scam-smell/` | Source, data, and fixtures |
