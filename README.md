# Startup Targets

Lead-gen tool for recruiting/staffing outreach: scans funding news for newly-funded
UK/EU startups in deep tech, climate, defence, energy, biotech, fintech, and health tech
(pre-seed/seed/Series A, backed by a top-tier VC) and surfaces them as targets to message.

Not LinkedIn scraping — pulls from public RSS feeds (see `src/lib/sources.ts`: Tech.eu,
EU-Startups, UKTN, ProjectStartups, TechCrunch) and uses AI to extract structured fields
from article text. LinkedIn is only used manually, at the end, to find the right person
at an already-qualified company.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres) for storage — see `supabase/schema.sql` and `supabase/seed_investors.sql`
- News sources — `src/lib/sources.ts` (RSS feeds, verified working 2026-07-11/12; Sifted's
  feed is bot-blocked, Silicon Canals' feed degraded into unrelated content — both excluded)
- Gemini (Google AI Studio) primary / Groq fallback for extraction — `src/lib/ai.ts`,
  `src/lib/extract.ts`
- Cron-triggered scan via `POST /api/scan` (shared secret in `Authorization` header),
  triggered daily by a GitHub Actions workflow — `.github/workflows/scan.yml`

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase, Gemini/Groq, and webhook secret values
```

Run the SQL in `supabase/schema.sql` then `supabase/seed_investors.sql` against your
Supabase project (via the SQL editor or CLI) to create tables and seed the default
top-tier VC list.

```bash
npm run dev
```

### Cron

`.github/workflows/scan.yml` calls `POST /api/scan` once a day via GitHub Actions
(free — a scan run only costs a few seconds of Actions minutes). Once the app is
deployed, set these in the repo's Settings → Secrets and variables → Actions:

- **Secret** `SCAN_WEBHOOK_SECRET` — same value as `SCAN_WEBHOOK_SECRET` in `.env.local`
- **Variable** `SCAN_URL` — the deployed app's base URL (e.g. `https://startup-targets.vercel.app`)

You can also trigger a run manually from the Actions tab (`workflow_dispatch`) without
waiting for the schedule.

## Pipeline

`POST /api/scan` (see `src/app/api/scan/route.ts`):

1. Fetch all configured RSS feeds (`src/lib/feeds.ts`), pulling full article text where
   feeds provide `content:encoded`.
2. Filter to articles published since the last scan (or the last 60 days, on a first run).
3. Dedup against `seen_articles` (bulk upsert with `ON CONFLICT DO NOTHING`, keeping only
   articles whose URL was newly inserted).
4. AI-extract structured deal data per article (`src/lib/extract.ts`) — a single article
   can yield zero, one, or many deals (some sources publish multi-company round-up posts).
5. Filter each extracted deal: stage must be pre-seed/seed/Series A, at least one investor
   must fuzzy-match the `investors` allowlist (`src/lib/matchInvestors.ts`), headcount ≤60
   if stated, and round size ≤$50M after currency conversion (`src/lib/fx.ts` — unrecognized
   currencies are excluded rather than risk letting an oversized round through).
6. Upsert qualifying deals into `targets` (existing rows are left untouched, so manual
   status changes like "contacted" never get clobbered by a re-scan).

Not yet tested end-to-end — needs a real Supabase project and Gemini/Groq API keys (see
Setup above) to verify against live data.

## Status

The scan/extract/filter pipeline is implemented but untested end-to-end (no Supabase
project or AI API keys configured yet). The dashboard UI is not yet implemented — the
homepage is still a placeholder. Not deployed.
