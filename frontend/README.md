# We Hate Scammers (frontend)

Next.js Akinator-style check for We Hate Scammers. This directory lives on `cursor/akinator-frontend-b8f7` only. **Backend, clients, and training data are unchanged.**

Answer a few questions; we rank the scam patterns that fit what just happened.

## Run locally

```bash
cd frontend
npm install
npm run dev -- --port 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

```bash
npm test            # ranking fixtures
npm run data:scams  # rebuild src/data/scams.json from data/*
```

The check runs entirely in the browser. Confirming a match tries `POST /api/v1/report` (proxied to a local detector on port 8000 when one is running) and also keeps a copy in `sessionStorage`. If the detector is down, the UI keeps an on-device save and shows an error — it does not change any backend code.

Optional: `DETECTOR_URL` overrides the proxy target (default `http://127.0.0.1:8000`).

## How ranking works

`src/lib/survey/engine.ts` scores every known pattern after each answer:

1. A frequency prior, with a small boost for high-priority methods.
2. Matches on how it started, what they asked for, and who they claimed to be.
3. Branch questions that split lookalike methods (government story, SMS type, romance vs pig-butchering, and so on).
4. Optional pasted text, scored on-device.
5. The next question is a short intro, then the unused scoring question with the highest information gain.

`POST /api/survey` accepts `{ answers: [{ questionId, value }] }`. `GET /api/scams?q=irs` lists patterns.

## Iterate

| Want to change | Edit |
| --- | --- |
| Questions and branch rules | `src/lib/survey/questions.ts` |
| Weights, stop rules, next-question picker | `src/lib/survey/engine.ts` |
| Ranking fixtures | `src/lib/survey/engine.test.ts` |
| Pattern corpus | `data/` then `npm run data:scams` |

## Stack

Next.js, React, TypeScript, Tailwind, shadcn/ui. No database or auth in this slice — the encyclopedia is bundled JSON so the check works offline and in preview.
