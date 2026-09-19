# Sherpa

Chrome extension that watches **Discord**, **Instagram**, **Reddit**, **Google Docs**, and **Google Slides** locally and highlights **suspicious** user text. Normal chat stays untouched. Caution is a muted yellow, high risk is a muted red, both translucent so the message stays readable.

Yellow highlights say **SUSPICIOUS**. Red highlights say **SCAM LIKELY: AVOID LINKS**.

Nothing is sent off your machine. This is a warning, not a verdict.

## Aggressiveness

Open the toolbar popup and use the Warn / Block switch.

| Mode | What it does |
| --- | --- |
| **Warn** (default) | Highlight the text. Hover a highlight for the reason when descriptions are on. Links open normally. |
| **Block** | Same highlights, and a click on a **highlighted** link always asks **Continue / Go back** and shows the real destination. Ordinary links are left alone. |

**Show descriptions** is a checkbox in the same menu. When it is on, a floating reason box appears on hover. When it is off, you only get the highlight.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open Discord, Instagram (including DMs), Reddit, Google Docs, or Google Slides

If it is already loaded, click **Reload** after pulling changes.

## Check that it works

1. Pin **Sherpa** from the Chrome puzzle-piece menu so the toolbar button stays visible.
2. Open Discord, Instagram, Reddit, Docs, or Slides.
3. Click the icon. It should say **Working on this tab**.
4. Set Warn / Block with the switch, and the descriptions checkbox. Those apply to the current tab immediately.

If it says it is not injected, reload the tab or reload the unpacked extension.

## What it flags

Offline cue matching + a small association graph + cross-family combos (urgency + payment, authority + credentials, and similar). See [`scam-smell/README.md`](scam-smell/README.md) for how the score is built and how to add cues or association edges in JSON only.

| Band | Score | Highlight |
| --- | --- | --- |
| ok | 0–24 | none |
| caution | 25–54 | yellow · SUSPICIOUS |
| high | 55–100 | red · SCAM LIKELY: AVOID LINKS |

Avatars, nav chrome, and composers are never painted.

| Site | Watched text |
| --- | --- |
| Discord | User messages (stable, PTB, Canary), including ones you just sent. Survives DM / channel switches. |
| Instagram | Direct messages, captions, and comments. Rebuilds word-split bubbles inside the DM form and paints only the text. |
| Reddit | Post bodies/titles and comments (new and old Reddit). |
| Google Docs | Comments, chat, and text as you type (including the canvas editor). Select a passage to rescore it. |
| Google Slides | Comments, speaker notes, and on-slide text boxes. Select canvas text to score it. |

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
| `settings.js` | Warn / Block + descriptions prefs |
| `content.js` | Site adapters, highlights, hover popup, link gate |
| `popup.html` / `popup.js` | Toolbar: mode switch, descriptions, ping |
| `content.css` | Highlighter, floating reason box, confirm gate |
| `scam-smell/` | Source, data, and fixtures |
