# Discord User Message Highlighter

A local Chrome extension that draws a red highlighter across Discord user chat text. The stroke swipes left to right and leaves a rounded, cylindrical mark on the words only — not the avatar or the message row. Nothing is sent off your machine.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open [discord.com](https://discord.com) in Chrome

If the extension is already loaded, click **Reload** on its card after pulling changes.

That is the whole setup. There is no account, API key, or build step.

## What it highlights

The actual message text. Avatars, the surrounding message box, date separators, and most system events (joins, pins, and similar) are left alone.

It matches Discord stable, PTB, and Canary.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Manifest V3, content script on Discord |
| `content.js` | Wraps user text; MutationObserver for instant updates |
| `content.css` | Left-to-right highlighter swipe + solid red ink |
