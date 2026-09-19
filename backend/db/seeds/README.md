# Reddit-derived scam pattern corpus for seeding Postgres `scams`

* extraction every Monday at 9am EST (automated using Grok Bot)

Source export: `reddit_scam_patterns.062126_091926.tsv` (~96 patterns).  
This is the **public scam encyclopedia seed**, not ML training audio.

```bash
cd backend/db
uv sync --group dev
# DATABASE_URL in .env
uv run alembic upgrade head
uv run python seed_reddit_patterns.py
```

Re-runs upsert on `name` (refresh `frequency` / tags / `description`).

---

## What this seed is

Each row is a **scam type/pattern**, not a single incident. Rows map 1:1 onto the `scams` table:

| Column | Type | Meaning |
|--------|------|---------|
| `id` | UUID PK | Stable id (`gen_random_uuid()`); seed UUIDs are fixed so re-imports stay stable |
| `name` | `VARCHAR(255)` unique | Snake-case label, e.g. `gift_card_bail` |
| `platforms` | `platform_enum[]` | `phone`, `sms`, `web`, `discord`, `other` |
| `ai_generated` | `BOOLEAN` nullable | Interaction used AI? `true` / `false` / `NULL` = unknown |
| `victim_roles` | `TEXT[]` | Role/demographic tags only (e.g. `elderly individual`) — no PII |
| `demands` | `demand_enum[]` | `cash`, `gift_card`, `wire`, `crypto`, `check`, `other` |
| `description` | `TEXT` | Keywords/phrases (method + reasoning); never raw transcripts |
| `frequency` | `INTEGER` | How often this pattern was seen in the sample (bumped on upsert) |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Audit timestamps |

Indexes: unique on `name`; GIN on `platforms`, `victim_roles`, `demands`.

---

## Scraping / collection pipeline

### 1. Goal

Build a **public, reproducible encyclopedia seed** of scam *patterns* from r/Scams community reports over a fixed window, then load them into Postgres for product use (lookup, tagging, frequency).

This is **not**:

- a full historical dump of Reddit
- an incident-level dataset (no raw threads as rows)
- ML audio / multimodal training data
- authenticated Reddit API scraping under a user account

### 2. Window & volume (this export)

| Field | Value |
|-------|--------|
| Subreddit | `r/Scams` |
| Window |*2026-06-21 → 2026-09-19** (~90 days) |
| Posts retrieved | **13,558** submissions |
| Patterns exported | **96** |
| Posts matched to a named pattern | **~1,422** (~10%) |
| Unmatched / residual | **~12,136** — mostly vague “is this a scam?” legit-checks, one-offs, or removed bodies |

Export filename convention: `reddit_scam_patterns.MMDDYY_MMDDYY.tsv` → `062126_091926`.

### 3. Access path (why not “scrape reddit.com”)

Direct fetches of `reddit.com` / `old.reddit.com` listing pages and `.json` endpoints returned **403 / challenge walls** from the collection environment (datacenter egress).

**Primary source used:** [Arctic Shift](https://arctic-shift.photon-reddit.com/) public archive API — live Reddit submission mirrors (title, body when present, score, comments, permalink, `created_utc`).

Pull shape (conceptual):

```text
GET https://arctic-shift.photon-reddit.com/api/posts/search
  ?subreddit=Scams
  &after=<unix_start>
  &before=<unix_end>
  &limit=100
  &sort=asc
```

Pagination:

 at window start (UTC).
2. Request pages of 100.
3. Advance the cursor to the max `created_utc` on the page (bump by 1s if stalled on duplicates).
4. Sleep ~1.2s between pages to respect rate limits.
5. Stop at window end or empty/short page.

Raw lean JSONL for audit (optional artifact): one object per submission with id, title, selftext, score, num_comments, created_utc, permalink, etc.

**Fallbacks considered (not used for this seed once Arctic Shift worked):** PullPush (rate-limited), authenticated Reddit API, browser automation. Prefer archive/API over HTML scraping.

### 4. Normalization → pattern rows

Pipeline after the JSONL exists:

1. **Usable text** — concatenate title + selftext; treat `[removed]` / `[deleted]` bodies as empty (titles still count).
2. **Pattern catalog** — hand-authored list of named patterns with:
   - snake_case `name`
   - allowed `platforms` / `demands` enum values
   - `victim_roles` tags (roles only)
   - keyword/regex rules for method phrases
   - `description` as able keywords (no transcripts, no PII)
3. **First-match assignment** — scan rules in specificity order; first hit wins (avoids double-counting one post into many patterns).
4. **`frequency`** — count of posts assigned to that pattern in the window.
5. **Drop zeros** — patterns with no hits in the window are omitted from the export.
6. **UUID stability** — known seed names keep fixed UUIDs across regenerations so upserts don’t churn PKs.
7. **Enum hygiene** — WhatsApp / Telegram / Instagram map to `other` (or `web` when the lure is primarily a web ad); `ai_generated` left empty (`NULL`) unless evidence is clear.

Caveats worth documenting for consumers:

- Regex clustering **under-counts** multi-theme posts and **misses** novel slang.
- High unmatched rate is expected: r/Scams is mostly triage threads, not clean labeled taxonomy.
- Frequencies reflect **what people posted**, not ground-truth prevalence in the wild.
- Many archive bodies are mod-removed; title-only matching still helps but loses n5. Export format

TSV/CSV columns (Postgres-friendly array literals):

```text
id, name, platforms, ai_generated, victim_roles, demands, description, frequency, created_at, updated_at
```

Examples:

- `platforms` → `{phone,sms}` or `{web,other}`
- `victim_roles` → `{"elderly individual","accident victim"}`
- `ai_generated` → empty cell means SQL `NULL`

Place the TSV where `seed_reddit_patterns.py` expects it (or pass the path the script documents), then run the seed commands above.

### 6. Ongoing refresh (Monday collector)

A scheduled job pulls the **prior 7 days** each Monday (09:00 America/New_York), re-runs the same cluster/upsert logic, and refreshes files:

- Match on `name`
- Bump `frequency` for hits that week
- Refresh platforms / demands / victim_roles / description when evidence is clearer
- Insert new patterns with new UUIDs
- Deliver a short delta summary + refreshed TSV/CSV

That keeps the encyclopedia seed current without re-pulling the full 90-day window every time.

### 7. Reproducis seed

Rough recipe:

```bash
# 1) Paginate Arctic Shift for the window → JSONL
# 2) Cluster with the pattern rule catalog → rows
# 3) Write reddit_scam_patterns.062126_091926.tsv
# 4) Seed gres
cd backend/db
uv sync --group dev
uv run alembic upgrade head
uv run python seed_reddit_patterns.py
```

Idempotent: re-running the seeder upserts on `name`.

---

## Top patterns in this export (by `frequency`)

| frequency | name |
|----------:|------|
| 121 | `facebook_marketplace_payment_scam` |
| 92 | `elder_romance_whatsapp_owed_money` |
| 79 | `job_offer_training_equipment_fee` |
| 55 | `rental_listing_deposit_scam` |
| 53 | `tiktok_shop_or_job_lure` |
| 51 | `zelle_venmo_wrong_person_refund` |
| 50 | `ticket_resale_fake` |
| 46 | `sextortion_webcam_blackmail` |
| 44 | `paypal_friends_family_goods` |
| 42 | `instagram_account_report_lure` |

Full list: the TSV.

---

## License / ethics notes

- Source material is **public Reddit submissions** mirrored via a public archive API.
- Seed stores **pattern abstractions** (labels, enums, keyword descriptions), not verbatim victim transcripts or PII.
- Not legal advice; community reports only.
