# Browser extension

Web-page / in-browser capture and warnings. **Source for this client only.**

| Do not put here | Lives in |
| --- | --- |
| Mic loopback / BlackHole / `.app` | [`desktop/`](../desktop/) |
| Marketing site, questionnaire, intel | [`frontend/`](../frontend/) |
| CLAP, Grok, Postgres | `backend/detector` on ravens |

The extension should only: grab tab/mic audio or page text if we add that, POST to the same detector, show a badge. No PyTorch, no `listen.py` imports.

Empty until we add a `manifest.json` here.
