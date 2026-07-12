-- Top-tier VC firms used as a viability/growth filter.
-- Editable: add/remove rows to tune which investors qualify a target.
create table if not exists investors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sectors text[] default '{}', -- optional: sector focus, informational only
  region text, -- UK | EU | Global — informational only
  created_at timestamptz not null default now()
);

-- One row per scan run, so we know where the last incremental scan left off.
create table if not exists scan_state (
  id int primary key default 1,
  last_scan_date timestamptz,
  constraint scan_state_singleton check (id = 1)
);
insert into scan_state (id, last_scan_date) values (1, null)
  on conflict (id) do nothing;

-- Raw articles seen, for dedup so we don't re-process the same story across sources/runs.
create table if not exists seen_articles (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  source text not null,
  published_at timestamptz,
  processed_at timestamptz not null default now()
);

-- Qualified startup targets surfaced by the pipeline.
create table if not exists targets (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website text,
  sector text, -- deep tech | climate | defence | energy | biotech | fintech | health tech
  stage text,  -- pre-seed | seed | series-a
  round_size_usd numeric,
  round_date date,
  investors text[] default '{}',
  headcount int, -- often null; may require manual fallback lookup
  source_url text,
  source_name text,
  summary text,
  status text not null default 'new', -- new | contacted | dismissed
  contact_name text, -- filled in later via manual LinkedIn lookup
  contact_linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_name, round_date)
);

create index if not exists targets_status_idx on targets (status);
create index if not exists targets_sector_idx on targets (sector);
create index if not exists targets_round_date_idx on targets (round_date);

-- RLS is enabled with no policies attached. The app only ever accesses these
-- tables server-side via the service_role key (src/lib/supabase.ts), which
-- bypasses RLS regardless of policies — so this doesn't change how the app
-- works. What it does do: lock out the anon/authenticated roles entirely,
-- so these tables aren't silently exposed via Supabase's public REST API if
-- the anon key ever ends up in client-side code or leaks some other way.
alter table investors enable row level security;
alter table scan_state enable row level security;
alter table seen_articles enable row level security;
alter table targets enable row level security;
