# Sherpa

Chrome extension that watches **Discord**, **Instagram**, **Reddit**, and **Google Drive** locally and highlights **suspicious** user text. Normal chat stays untouched.

Caution highlights say **SUSPICIOUS**. High-risk highlights say **SCAM LIKELY: AVOID LINKS**. Ink color follows the Light / Dark theme: Highlights for high risk, H3 for caution.

This is a warning, not a verdict. Scoring stays on the device.

## Aggressiveness

Open the toolbar popup and use the Warn / Block switch.

| Mode | What it does |
| --- | --- |
| **Warn** (default) | Highlight the text. Hover a highlight for the reason when hover comments are on. Links open normally. |
| **Block** | Highlighted links prompt to continue/go back when clicked. Ordinary links are left alone. |

**Show hover comments** is a checkbox in the same menu. Clicking it shows or hides the hover reason cards on the current tab right away and leaves the colored marks on. You should not need to reload the page.

## Theme

The toolbar has a Light / Dark switch. It restyles the popup, hover cards, Block gate, live Drive bar, and highlight ink.

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#F2E8CF` | `#0F1020` |
| Highlights | `#BC4749` | `#EFC3F5` |
| H1 | `#011627` | `#2F195F` |
| H2 | `#658E9C` | `#7353BA` |
| H3 | `#99B2DD` | `#FAA6FF` |

## Report a scam

**Report a scam** sits in the toolbar, on hover cards, on the Block gate, and on the live Drive bar. The destination site is not wired yet — the button opens a local report page and will take the URL you provide later. Flagged text, site, and band travel as query parameters.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open Discord, Instagram (including DMs), Reddit, or Google Drive

If it is already loaded, click **Reload** after pulling changes.

## Check that it works

1. Pin **Sherpa** from the Chrome puzzle-piece menu so the toolbar button stays visible.
2. Open Discord, Instagram, Reddit, or Drive.
3. Click the icon. It should say **Working on this tab**.
4. Set Warn / Block, Light / Dark, and the hover-comments checkbox. Those apply to the current tab immediately.

If it says it is not injected, reload the tab or reload the unpacked extension.

## What it flags

Offline cue matching + a small association graph + cross-family combos (urgency + payment, authority + credentials, and similar). See [`scam-smell/README.md`](scam-smell/README.md) for how the score is built and how to add cues or association edges in JSON only.

| Band | Score | Highlight |
| --- | --- | --- |
| ok | 0–24 | none |
| caution | 25–54 | H3 ink · SUSPICIOUS |
| high | 55–100 | Highlights ink · SCAM LIKELY: AVOID LINKS |

Avatars, nav chrome, and composers are never painted.

| Site | Watched text |
| --- | --- |
| Discord | User messages (stable, PTB, Canary), including ones you just sent. Survives DM / channel switches. |
| Instagram | Direct messages, captions, and comments. Rebuilds word-split bubbles inside the DM form and paints only the text. |
| Reddit | Post bodies/titles and comments (new and old Reddit). |
| Google Drive | Comments and activity on `drive.google.com` (file viewer, comment sidebar, clickable cards). |

## Develop

```bash
npm install
npm test
npm run build
```

`npm run build` writes `scorer.js` for the unpacked extension.

To preview the themed demo locally:

```bash
python3 -m http.server 43147 --bind 127.0.0.1
```

Then open `http://127.0.0.1:43147/demo.html`.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Manifest V3 |
| `scorer.js` | Bundled offline analyzer |
| `settings.js` | Warn / Block, descriptions, theme, report URL |
| `content.js` | Site adapters, highlights, hover popup, link gate |
| `popup.html` / `popup.js` | Toolbar: mode, theme, highlights, report |
| `report.html` | Interim report page until a public form URL is set |
| `content.css` | Themed highlighter, floating reason box, confirm gate |
| `scam-smell/` | Source, data, and fixtures |
