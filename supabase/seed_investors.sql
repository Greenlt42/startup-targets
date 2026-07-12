-- Default "top-tier VC" list, weighted to UK/EU firms since sourcing is
-- UK/EU news feeds (see src/lib/sources.ts). Starting point only — edit the
-- `investors` table directly (or re-run this file) to add/remove firms.

insert into investors (name, sectors, region) values
  -- generalist / cross-sector (UK/EU)
  ('Index Ventures', array['deep tech','biotech','defence'], 'EU'),
  ('Atomico', array['deep tech'], 'UK'),
  ('Balderton Capital', array['deep tech'], 'UK'),
  ('Northzone', array['deep tech'], 'EU'),
  ('EQT Ventures', array['deep tech','climate'], 'EU'),
  ('Lakestar', array['deep tech','defence'], 'EU'),
  ('Cherry Ventures', array['deep tech'], 'EU'),
  ('Speedinvest', array['deep tech','climate'], 'EU'),
  ('Seedcamp', array['deep tech'], 'UK'),
  ('Molten Ventures', array['deep tech'], 'UK'),
  ('Octopus Ventures', array['deep tech','climate','biotech'], 'UK'),
  -- deep tech
  ('IQ Capital', array['deep tech'], 'UK'),
  ('Amadeus Capital Partners', array['deep tech'], 'UK'),
  ('Cambridge Innovation Capital', array['deep tech'], 'UK'),
  ('OTB Ventures', array['deep tech'], 'EU'),
  ('Vsquared Ventures', array['deep tech'], 'EU'),
  ('Parkwalk Advisors', array['deep tech'], 'UK'),
  ('Join Capital', array['deep tech'], 'EU'),
  -- climate / energy
  ('Breakthrough Energy Ventures Europe', array['climate','energy'], 'EU'),
  ('World Fund', array['climate'], 'EU'),
  ('Extantia Capital', array['climate'], 'EU'),
  ('Planet A Ventures', array['climate'], 'EU'),
  ('2150', array['climate'], 'EU'),
  ('Systemiq Capital', array['climate'], 'UK'),
  ('Zero Carbon Capital', array['climate'], 'UK'),
  ('Contrarian Ventures', array['energy'], 'EU'),
  -- defence
  ('NATO Innovation Fund', array['defence','deep tech'], 'EU'),
  ('Project A Ventures', array['defence','deep tech'], 'EU'),
  -- biotech
  ('Forbion', array['biotech'], 'EU'),
  ('Sofinnova Partners', array['biotech'], 'EU'),
  ('Medicxi', array['biotech'], 'EU'),
  ('Syncona', array['biotech'], 'UK'),
  ('Abingworth', array['biotech'], 'UK'),
  ('Andera Partners', array['biotech'], 'EU'),
  ('Kurma Partners', array['biotech'], 'EU'),
  ('LSP (Life Sciences Partners)', array['biotech'], 'EU'),
  ('Novo Holdings', array['biotech'], 'EU'),
  ('Seventure Partners', array['biotech'], 'EU')
on conflict (name) do nothing;

-- Funds surfaced via LP/fund-of-funds research (2026-07-12): several firms
-- above don't just invest directly — they also act as LPs into other VC
-- funds. Backing from those downstream funds is still a real quality signal,
-- so they're captured here too. Researched via web search on 2026-07-12;
-- re-verify periodically as LP relationships change.
--
-- Of the 35 firms above, only these were confirmed LP/fund-of-funds
-- investors (the other 29 are direct-only): Atomico, Speedinvest, Molten
-- Ventures, Extantia Capital, NATO Innovation Fund, Novo Holdings.
-- Speedinvest's fund-of-funds commitments (an unnamed "Fund F" and one other
-- unnamed fund, both aimed at Latin America/Africa) were excluded — no
-- concrete fund names, and the geographic mandate doesn't fit UK/EU sourcing.
-- Six downstream funds were already on the list above (Seedcamp, OTB
-- Ventures, Join Capital, Vsquared Ventures, 2150, Zero Carbon Capital) —
-- a good cross-validation signal, not re-inserted here.

insert into investors (name, sectors, region) values
  -- via Atomico's fund-of-funds programme
  ('Visionaries Club', array[]::text[], 'EU'),
  ('Puzzle Ventures', array[]::text[], 'EU'),
  ('Common Magic', array[]::text[], 'EU'),
  ('Tiny VC', array[]::text[], 'UK'),
  ('Ada Ventures', array[]::text[], 'UK'),
  ('Cornerstone VC', array[]::text[], 'UK'),
  ('Unconventional Ventures', array[]::text[], 'EU'),
  ('Pale Blue Dot', array['climate'], 'EU'),
  ('Firstminute Capital', array[]::text[], 'UK'),
  -- via Molten Ventures' "Backing Europe's best seed funds" programme
  ('Connect Ventures', array[]::text[], 'UK'),
  ('Earlybird Digital East', array[]::text[], 'EU'),
  ('Eka Ventures', array['climate'], 'UK'),
  ('Moonfire', array[]::text[], 'UK'),
  -- via Extantia Capital's "Extantia Allstars" fund-of-funds
  ('Astanor', array['climate'], 'EU'),
  ('Lowercarbon Capital', array['climate','energy'], 'Global'),
  ('Fifth Wall', array['climate'], 'Global'),
  ('Energy Impact Partners', array['energy','climate'], 'Global'),
  ('Just Climate', array['climate'], 'UK'),
  ('Counteract', array['climate'], 'EU'),
  -- via NATO Innovation Fund's fund-of-funds programme
  ('Alpine Space Ventures', array['deep tech'], 'EU'),
  ('Faber', array['deep tech'], 'EU'),
  ('BSV Ventures', array['deep tech','biotech','defence'], 'EU'),
  ('201 Ventures', array['defence','deep tech'], 'EU'),
  ('Expeditions', array['defence'], 'EU'),
  ('Twin Track Ventures', array['deep tech'], 'EU'),
  -- via Novo Holdings' quantum-tech + life-science fund commitments
  ('Sunstone Life Science Ventures Fund IV', array['biotech'], 'EU'),
  ('BioGeneration Ventures IV', array['biotech'], 'EU'),
  ('55 North', array['deep tech'], 'EU'),
  ('Quantonation II', array['deep tech'], 'EU'),
  ('Playground Global IV', array['deep tech'], 'Global')
on conflict (name) do nothing;
