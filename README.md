# Startup Targets

Lead-gen tool for recruiting/staffing outreach: scans funding news for newly-funded
UK/EU startups in deep tech, climate, defence, energy, biotech, fintech, and health tech
(pre-seed/seed/Series A, backed by a top-tier VC) and surfaces them as targets to message
via a dashboard.

Not LinkedIn scraping — pulls from public RSS feeds and article listing pages (see
`src/lib/sources.ts`), then uses AI to extract structured fields from article text.
LinkedIn is only used manually, at the end, to find the right person at an
already-qualified company.

**Live at:** https://startup-targets.vercel.app

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind, deployed on Vercel
- Supabase (Postgres) for storage — `supabase/schema.sql`, seeded investor allowlist in
  `supabase/seed_investors.sql`
- Sources — `src/lib/sources.ts`:
  - RSS (`NEWS_SOURCES`): Tech.eu, EU-Startups, UKTN, ProjectStartups (global funding
    aggregator), TechCrunch (fundraising category), Balderton Capital (their own
    portfolio-announcement blog — high-precision since Balderton is already on the
    investor allowlist, so a "raises $X" post there almost always passes the
    investor-match filter automatically)
  - HTML listing pages with no RSS feed (`LISTING_SOURCES`): Scaling Europe — link
    discovery via regex over the listing page's raw HTML instead of parsing XML
  - Rejected candidates and the reasoning for each are documented inline in
    `sources.ts` (Sifted, Silicon Canals, fundediq.com/.co, idealondon.co.uk/idea-london.co.uk,
    scalingeurope.com, funding.tech.eu, and others)
- AI extraction — `src/lib/ai.ts`, `src/lib/extract.ts`. Fallback chain tried in order
  until one succeeds: Groq `llama-3.1-8b-instant` → Groq `gpt-oss-20b` → Groq
  `llama-3.3-70b-versatile` → Gemini (`gemini-2.0-flash`). Small/fast models first —
  this is structured extraction, not deep reasoning, and Groq's rate limits are
  per-model, so each tier is a separate quota bucket. Gemini is last because it's
  currently stuck at 0 free-tier quota (needs a billing/API-enablement check on the
  Google Cloud project) — the Groq tiers carry the load fine in the meantime.
- Cron-triggered scan via `POST /api/scan` (shared secret in `Authorization` header),
  triggered every 2 hours by a GitHub Actions workflow — `.github/workflows/scan.yml`
- Dashboard — `src/app/page.tsx`, fully server-rendered (no client JS): stat tiles,
  status/sector filter pills, and a table (including each target's HQ location) with
  per-target actions (mark contacted/dismissed/reopen) via Next.js Server Actions
  (`src/app/actions.ts`)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase, Gemini/Groq, and webhook secret values
```

Run the SQL in `supabase/schema.sql` then `supabase/seed_investors.sql` against your
Supabase project (via the SQL editor or CLI) to create tables and seed the default
top-tier VC list. Both files are safe to re-run in full — table/column creation is
guarded with `if not exists` and investor inserts with `on conflict do nothing`.

```bash
npm run dev
```

### Cron

`.github/workflows/scan.yml` calls `POST /api/scan` every 2 hours via GitHub Actions
(free — a scan run only costs a few seconds of Actions minutes). Once the app is
deployed, set these in the repo's Settings → Secrets and variables → Actions:

- **Secret** `SCAN_WEBHOOK_SECRET` — same value as `SCAN_WEBHOOK_SECRET` in `.env.local`
- **Variable** `SCAN_URL` — the deployed app's base URL (e.g. `https://startup-targets.vercel.app`)

You can also trigger a run manually from the Actions tab (`workflow_dispatch`) without
waiting for the schedule.

**Known limitation:** GitHub Actions' `schedule` trigger doesn't fire at exact
intervals — observed gaps against the configured 2-hourly cron have ranged from
1h20m to 4h30m. A longer gap means more of a backlog to work through in one run,
which risks exceeding Vercel's function timeout. Mitigated, not eliminated, by
bounding how much work one run attempts (see Pipeline) — a run that can't finish
the full backlog in time stays safely retryable rather than failing outright.

### Deploying

```bash
vercel --prod
```

`maxDuration = 60` is set on the scan route (`src/app/api/scan/route.ts`) — the max
Vercel allows on the Hobby plan (Pro allows up to 300s). The first big catch-up run
(a fresh Supabase project with no scan history, or right after adding a new source —
see Historical backfill / Listing source catch-up below) should be triggered manually
against the deployed URL with a generous client-side timeout, or run locally via the
scripts below, rather than left to cron — it has far more to process than a
steady-state incremental run and would otherwise repeatedly hit the time budget.

## Pipeline

`POST /api/scan` (`src/app/api/scan/route.ts`) and the one-time scripts in `scripts/`
both build on shared logic in `src/lib/pipeline.ts`, so scheduled scans and manual
catch-ups apply identical rules:

1. Fetch every RSS source (`fetchAllArticles`) and every listing-page source
   (`fetchAllListingSourceArticles`) in `src/lib/feeds.ts`.
2. Filter to articles published since the last scan (or the last 60 days, on a first run).
3. Dedup against `seen_articles`.
4. Shuffle the remaining candidates, then bound the run two ways: a 25-article cap
   (`MAX_ARTICLES_PER_RUN`) and a 35-second wall-clock budget (`TIME_BUDGET_MS`,
   checked between articles), whichever hits first. The article count alone wasn't
   enough — confirmed live that per-article time varies hugely with how much AI-provider
   fallback cascading happens, so a run could still exceed Vercel's 60s limit well under
   the count cap. The shuffle matters too: candidates used to be built as
   `[...feedArticles, ...listingArticles]` and simply sliced, so any run where RSS
   sources alone produced ≥25 new candidates gave a listing source zero chance of a
   slot — confirmed live, Scaling Europe sat at 1/50 processed across multiple cron
   cycles until this was fixed. A run that hits either bound behaves like an errored
   one (see step 8): it doesn't advance the cutoff, so the next run picks up right
   where it left off.
5. For each article, enrich thin content (RSS teaser under ~400 chars, or a
   listing-source article with no RSS content at all) by fetching the full article
   page — `fetchFullArticlePage` in `feeds.ts` pulls both the main-content text
   (longest match across common WordPress/news content selectors — picking the first
   match isn't safe: confirmed live that `article:first()` grabbed a 40-char login
   widget on one site instead of the real ~1500-char body in `main`) and, where
   present, a publish date from embedded Schema.org JSON-LD.
6. AI-extract structured deal data (`src/lib/extract.ts`) — a single article can yield
   zero, one, or many deals (some sources publish multi-company round-up posts). The
   prompt requires a company's core product to genuinely *be* one of the seven target
   sectors, not merely adjacent to or serving one of them, and asks for the company's
   HQ location ("City, Country") only when explicitly stated — never guessed.
7. Filter each extracted deal: stage must be pre-seed/seed/Series A, at least one
   investor must fuzzy-match the `investors` allowlist (`src/lib/matchInvestors.ts`),
   headcount ≤60 if stated, round size ≤$50M after currency conversion
   (`src/lib/fx.ts` — unrecognized currencies are excluded rather than risk letting an
   oversized round through), and it isn't a cross-source duplicate of an existing
   target (case-insensitive company-name match within a 7-day date tolerance —
   different sources sometimes cover the same round with slightly different
   capitalization or a reporting date a day or two off).
8. Upsert qualifying deals into `targets` (existing rows are left untouched, so manual
   status changes like "contacted" never get clobbered by a re-scan). An article is
   only marked "seen" once every deal in it saved successfully — a partial failure
   keeps the whole article eligible for retry. `last_scan_date` only advances when a
   run is error-free and finished the full backlog (didn't hit either bound in step 4).

Per-reason rejection counts (`stats.rejections` in the JSON response) give visibility
into the filter funnel for diagnosing recall issues.

### One-time scripts

All run manually via `npx tsx scripts/<name>.ts`, not part of the scheduled cron:

- **`backfill.ts [pagesPerSource]`** (default 5) — paginates through Tech.eu, UKTN, and
  TechCrunch's archive/category pages (all have working date-based URL pagination going
  back months) to discover articles older than what the live RSS feeds currently
  expose. EU-Startups is excluded: its category/listing pages return 403 live and its
  Wayback Machine snapshots come back empty.
- **`catchup-listing-sources.ts`** — processes every currently-discoverable article
  from `LISTING_SOURCES` with no cap. Run this right after adding a new listing source
  so its backlog doesn't have to wait on the regular cron's shuffle to eventually deal
  it enough slots.
- **`backfill-location.ts`** — one-off fix-up for targets inserted before the
  `location` field existed: re-fetches each target's source article and updates just
  the `location` column on the existing row (by id — never inserts a new row or
  touches any other field).

## Data model

`targets` (see `supabase/schema.sql` for the full definition): company name, website,
sector, stage, round size (USD), round date, investors, headcount, location (company
HQ as stated in the article — often just a country, sometimes "City, Country", null if
not mentioned), source URL/name, a one-sentence summary, status
(new/contacted/dismissed), and manually-filled contact fields for the LinkedIn lookup
step.

`investors` — the top-tier VC allowlist, weighted UK/EU with a `region` column,
editable directly in Supabase. Includes both direct-investing firms and funds
surfaced via research into which allowlisted investors also act as LPs into other VC
funds (e.g. NATO Innovation Fund, Atomico, Molten Ventures, Extantia Capital, Novo
Holdings all run genuine fund-of-funds programs) — see the comments in
`supabase/seed_investors.sql`.

`seen_articles` / `scan_state` — dedup and incremental-scan bookkeeping.

RLS is enabled on all tables with no policies attached — the app only ever accesses
Supabase server-side via the `service_role` key (`src/lib/supabase.ts`, with fetch
caching explicitly disabled — Next.js caches `fetch()` in production by default,
which silently served stale dashboard data until this was fixed), so this doesn't
change app behavior. It locks out `anon`/`authenticated` from Supabase's public REST
API in case that key ever ends up in client-side code or leaks some other way.

## Open items

- Gemini's free-tier quota is stuck at 0 — needs a billing/API-enablement check on the
  Google Cloud project it's tied to. Not urgent: the Groq fallback tiers handle
  extraction fine in the meantime.
- Headcount is rarely stated in source articles; no fallback lookup strategy (e.g.
  checking a company's site/LinkedIn manually) has been decided yet.
- GitHub → Vercel auto-deploy-on-push status is unconfirmed; deploys have been done
  manually via `vercel --prod` throughout development.
- Sector classification is prompt-tuned but not perfect — smaller-model
  non-determinism means an occasional adjacent-not-core company (e.g. a workforce
  training program tagged "climate") can still slip through; worth spot-checking the
  dashboard periodically.
- Worth checking more of the 68 allowlisted investors' own sites for the same
  "high-precision portfolio blog" pattern that worked well for Balderton — Index
  Ventures, Atomico, Seedcamp, Octopus Ventures, and Molten Ventures were tried and
  hit blocks or no feed at the paths guessed, but more may be worth a look.
