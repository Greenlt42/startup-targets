# Startup Targets

Lead-gen tool for recruiting/staffing outreach: scans funding news for newly-funded
UK/EU startups in deep tech, climate, defence, energy, and biotech (pre-seed/seed/Series A,
backed by a top-tier VC) and surfaces them as targets to message.

Not LinkedIn scraping — pulls from public RSS feeds (see `src/lib/sources.ts`: Tech.eu,
EU-Startups, UKTN, Silicon Canals) and uses AI to extract structured fields from article
text. LinkedIn is only used manually, at the end, to find the right person at an
already-qualified company.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres) for storage — see `supabase/schema.sql` and `supabase/seed_investors.sql`
- News sources — `src/lib/sources.ts` (RSS feeds, verified working 2026-07-11; Sifted's
  feed is bot-blocked and excluded)
- Gemini (Google AI Studio) primary / Groq fallback for extraction — `src/lib/ai.ts`
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

## Status

Skeleton only — the scan/extract/filter pipeline (`src/app/api/scan/route.ts`) and the
dashboard UI are not yet implemented.
