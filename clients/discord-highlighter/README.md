# Discord User Message Highlighter

A local Chrome extension that paints every Discord user chat message with a red highlight. New messages are marked as soon as they appear. Nothing is sent off your machine.

## Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder (the one with `manifest.json`)
4. Open [discord.com](https://discord.com) in Chrome

That is the whole setup. There is no account, API key, or build step.

## What it highlights

Chat messages with actual user text. Date separators and most system events (joins, pins, and similar) are left alone.

It matches Discord stable, PTB, and Canary.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Manifest V3, content script on Discord |
| `content.js` | Marks user messages; MutationObserver for instant updates |
| `content.css` | Red highlighter wash and left accent |
