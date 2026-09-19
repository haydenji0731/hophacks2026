# Deploy tonight (public domain)

The frontend is a **static Vite SPA**. The detector API + Postgres stay on **ravens** (university LAN, `10.168.56.86`). Dev `/api` proxy in `frontend/vite.config.js` **does not exist in production**.

Mac capture still uses `ssh -N -L 8000:localhost:8000 hji@ravens` either way.

---

## Decisions (make these first)

| # | Question | Options | Hackathon default |
| --- | --- | --- | --- |
| 1 | What does the domain serve? | **A)** Site only (news falls back to `frontend/src/data/news.js`; report/news API may fail in visitors’ browsers). **B)** Site + live API (`/v1/news`, `/v1/report`). | **A** if short on time; **B** if judges should see live cards off campus |
| 2 | Where does the SPA live? | Cloudflare Pages / Vercel / Netlify / GitHub Pages vs nginx on ravens | **Cloudflare Pages or Vercel** (free HTTPS). Ravens has no public IP. |
| 3 | Apex vs `www` | `yourdomain.club` vs `www.yourdomain.club` | One canonical host + redirect the other. Match what the host asks for. |
| 4 | How `/api` reaches ravens (only if 1B) | Cloudflare Tunnel from ravens; ngrok/bore (dies when the process stops); do **not** publish `10.168.x.x:8000` | **Cloudflare Tunnel** → `api.<domain>` |
| 5 | CORS | If site and API are different origins, allow the site origin on FastAPI | Same-origin proxy avoids CORS; split host needs `allow_origins` |
| 6 | What stays private | `.env`, keys, `/v1/process` (optional to keep off the public hostname) | Set `NEWS_REFRESH_SECRET` if refresh is public |

**Do not** try to run CLAP / Torch / `/v1/process` on Pages/Vercel. Detector + Postgres + `.env` stay together.

---

## Path 1A — Domain = static site only

Fastest. Live news/report stay on the tunneled Mac demo.

1. Freeze frontend.
2. Build:
   ```bash
   cd frontend
   npm run build
   ```
   Publish `frontend/dist/`.
3. Create a Cloudflare Pages / Vercel project:
   - Root: `frontend`
   - Build: `npm run build`
   - Output: `dist`
4. **SPA fallback:** all routes (`/scams/:id`, `/questionnaire`, …) → `index.html`. Otherwise refresh 404s.
5. Registrar DNS: CNAME/A records the host shows. Wait for TLS before sharing the URL.
6. Check on the real domain: `/`, `/our-goal`, `/scams`, `/questionnaire`, hard-refresh a `/scams/...` URL.
7. News widget: static FTC cards if `/api/v1/news` fails. Expected for 1A.

---

## Path 1B — Site + public API (Option A: expose ravens, don’t relocate)

University network blocks **inbound** `:8000`. A tunnel works because ravens makes an **outbound** HTTPS connection to Cloudflare (same way it already calls xAI). No public IP, no port-forward.

**Policy:** some campuses treat persistent tunnels like ngrok. Technically fine; confirm if HopHacks/IT cares.

### A. Tunnel on ravens

```bash
# on ravens
cloudflared tunnel login
cloudflared tunnel create whs-api
# config: ingress http://127.0.0.1:8000
cloudflared tunnel route dns <TUNNEL_ID> api.YOURDOMAIN.club
cloudflared tunnel run whs-api
```

If QUIC is blocked on campus, force HTTP/2 (see current `cloudflared` protocol flag).

Uvicorn stays:

```bash
cd /mnt/disk2/hji/hophacks2026/backend/detector
uv run uvicorn app:app --host 127.0.0.1 --port 8000
```

Keep `cloudflared` running (tmux/systemd). If ravens sleeps or the tunnel process dies, the API dies with it.

### B. Prove it off campus

From a phone **not** on Hopkins Wi‑Fi:

```bash
curl -sS https://api.YOURDOMAIN.club/health
```

Expect `{"status":"ok","service":"scam-detector"}`.

### C. CORS

In `backend/detector/app.py`, add the real site origin(s) to `CORSMiddleware` `allow_origins`, e.g. `https://YOURDOMAIN.club` and `https://www.YOURDOMAIN.club`. Restart uvicorn.

### D. Frontend API base

Fetches are hardcoded as `/api/v1/news` and `/api/v1/report`. Vite proxy rewrites that only in `npm run dev`.

Tonight you need one of:

- Host rewrite: `/api/*` → `https://api.YOURDOMAIN.club/*` (strip `/api` like the Vite proxy), **or**
- Code: `VITE_API_BASE` (empty in dev, `https://api.YOURDOMAIN.club` in the production build) and rebuild.

Rebuild after changing Vite env; it is inlined at build time.

### E. Lock down public surfaces

- Set `NEWS_REFRESH_SECRET` on ravens; Grok Bot / curl must send `X-News-Refresh-Secret`.
- Prefer **not** putting `/v1/process` on the public hostname (path rule on the tunnel, or a second internal-only bind).

### F. Optional: only news + report

Judges need GET `/v1/news` and POST `/v1/report`. Capture can stay SSH-tunneled to `:8000`.

---

## Actually moving the API off ravens (Option B)

Only if ravens will be **down** at judging.

| Host | What works |
| --- | --- |
| Fly / Render / Railway | FastAPI + Postgres **without** `--extra kws`. News + report. `/v1/process` weak or missing. |
| Another Linux GPU box | Full pipeline. Copy repo, `uv sync --extra kws`, restore Postgres, same `.env` keys. |

```text
pg_dump (ravens)     →  new Postgres
git pull / rsync     →  new box
uv sync              →  skip --extra kws if no GPU
copy backend/detector/.env
uvicorn --host 127.0.0.1 --port 8000
point api.YOURDOMAIN.club at that box (or another tunnel)
```

Postgres and the detector process must stay on the same side of the firewall.

---

## Night-of order

1. Lock decisions table (especially **1A vs 1B**).
2. Freeze frontend → `npm run build` → Pages/Vercel + DNS + SPA fallback.
3. If 1B: tunnel + `/health` from cellular + CORS + API base + `NEWS_REFRESH_SECRET`.
4. Walk `/`, intel, questionnaire, news widget on the **domain**, not `:5175`.

Registrar login, GitHub ↔ Pages/Vercel, and (for 1B) a Cloudflare account on the same domain are the only accounts you need.
