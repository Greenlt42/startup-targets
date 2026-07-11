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
  intended to be called by a scheduled Make.com scenario

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

## Status

Skeleton only — the scan/extract/filter pipeline (`src/app/api/scan/route.ts`) and the
dashboard UI are not yet implemented.
