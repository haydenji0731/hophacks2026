# Website questionnaire (this branch)

Next.js Akinator-style check for We Hate Scammers. This directory replaces the Vite stub **on `cursor/akinator-frontend-b8f7` only**. Backend, clients, and training data are unchanged.

## Run

```bash
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

```bash
npm test          # ranking fixtures
npm run data:scams  # rebuild src/data/scams.json from data/*
```

## Detector compatibility

The survey ranks locally from the encyclopedia + Grok Bot catalog tags. **This is what happened to me** still POSTs to the existing detector:

`POST /api/v1/report` → proxied to `http://127.0.0.1:8000/v1/report`

Start `backend/detector` on port 8000 if you want the upsert. If it is down, the UI keeps an on-device save and shows an error — it does not change any backend code.

Optional: `DETECTOR_URL` overrides the proxy target (default `http://127.0.0.1:8000`).
