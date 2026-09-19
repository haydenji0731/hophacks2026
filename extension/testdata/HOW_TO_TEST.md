# How to test the extension

The extension only runs in **Chromium / Chrome**, on **https://discord.com** (also Instagram and Facebook). It does **not** run in the Discord desktop app.

## 1. Prove the engine (no Discord)

From the **repository root** (not `frontend/`):

```bash
node extension/scripts/test-score.mjs
```

Then in Chromium: extension popup → **Open test fixture**. Hard cards should show `hard`; the birthday gift-card line stays at score 3.

## 2. Prove Discord in this browser

1. `chrome://extensions` (or `chromium://extensions`) → the extension is **enabled**.
2. Popup: **Master enable** on, **Discord** on.
3. Open **https://discord.com/channels/@me** in this same Chromium window (a server or DM).
4. **Reload that Discord tab** after every Load unpacked / extension reload. Discord is already mounted before the script injects otherwise.
5. Open the popup on that tab. You should see **Scanner attached on Discord**.
6. Send **exactly** one of these (vague “this is a scam” lines will not hit):

Hard (banner):

```
This is the IRS. Buy gift cards and read the codes before we issue a warrant.
```

```
Hey grandma, I need bail. Don't tell mom. Western Union, cash bond, now.
```

Soft only (badge, no banner):

```
This is urgent — can you grab a gift card for the office party?
```

Miss (nothing):

```
I got you a gift card for your birthday dinner tonight.
```

Watch the **toolbar badge** (yellow = soft, red = hard) and a bottom-right banner on hard hits. The banner never repeats the message text.

## If nothing happens

| Check | What it means |
| --- | --- |
| Discord desktop / Discord app | Extensions cannot run there. Use discord.com in Chromium. |
| Popup says content script is not injected | Reload the extension, then reload the Discord tab. |
| Popup says scanner is off | Master or Discord toggle is off. |
| Phrase is “scammy” but informal | Weak words (`urgent`, `gift`) stay under the hard threshold on purpose. |
| You are in `frontend/` running `node extension/scripts/...` | Wrong folder. `extension/` is at the **repo root**. |

Inspect: `chromium://extensions` → service worker → Errors. On the Discord tab: DevTools → Content scripts.
