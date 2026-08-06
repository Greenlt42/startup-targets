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

-- Fintech + health tech coverage (2026-08-06): these two sectors were added
-- to product scope in commit f067300, but the seed lists above had zero
-- firms tagged for either — every fintech/health-tech deal was structurally
-- guaranteed to fail the investor-match filter regardless of deal quality.
-- Researched via web search on 2026-08-06; UK/EU-weighted per sources.ts,
-- restricted to firms confirmed still actively deploying at pre-seed/seed/
-- Series A as of 2025-2026 (not defunct, not growth/late-stage-only).
--
-- Also adds two climate/energy near-misses surfaced by live-testing
-- extraction on real unseen articles on 2026-08-06. Barclays Climate
-- Ventures is a conventional (if corporate-backed) VC investor — confirmed
-- active, £71m deployed in 2025 alone. Great British Energy is a UK
-- state-owned clean-energy investment vehicle (est. 2024, £5.8bn allocated),
-- not a private VC — same structural category as NATO Innovation Fund
-- already on this list. It does write direct equity checks into individual
-- startups today (e.g. its ~£8.8m investment in Naked Energy, reported
-- 2026-08-06) — the kind of deal this filter exists to catch.

insert into investors (name, sectors, region) values
  -- fintech
  ('QED Investors', array['fintech'], 'Global'),
  ('Anthemis Group', array['fintech'], 'UK'),
  ('Illuminate Financial', array['fintech'], 'UK'),
  ('Blossom Capital', array['fintech','deep tech'], 'UK'),
  ('Fasanara Capital', array['fintech'], 'UK'),
  ('Point Nine Capital', array['fintech'], 'EU'),
  ('Finch Capital', array['fintech'], 'EU'),
  ('MMC Ventures', array['fintech'], 'UK'),
  ('Frontline Ventures', array['fintech'], 'EU'),
  ('Force Over Mass', array['fintech'], 'UK'),
  ('Fuel Ventures', array['fintech'], 'UK'),
  ('Global Founders Capital', array['fintech'], 'EU'),
  ('Augmentum Fintech', array['fintech'], 'UK'),
  -- health tech
  ('Heal Capital', array['health tech'], 'EU'),
  ('Gilde Healthcare', array['health tech','biotech'], 'EU'),
  ('Albion VC', array['health tech','biotech'], 'UK'),
  ('Bethnal Green Ventures', array['health tech'], 'UK'),
  ('Longwall Ventures', array['health tech','deep tech'], 'UK'),
  ('Oxford Science Enterprises', array['health tech','deep tech','biotech'], 'UK'),
  ('High-Tech Gründerfonds', array['health tech','deep tech'], 'EU'),
  ('Partech', array['health tech','fintech'], 'EU'),
  ('F-Prime Capital', array['health tech','biotech'], 'Global'),
  ('Air Street Capital', array['health tech','deep tech'], 'UK'),
  ('Digital Health Ventures', array['health tech'], 'EU'),
  ('Mercia Asset Management', array['health tech'], 'UK'),
  -- climate / energy (near-misses surfaced via live extraction testing)
  ('Barclays Climate Ventures', array['climate','energy'], 'UK'),
  ('Great British Energy', array['climate','energy'], 'UK')
on conflict (name) do nothing;

-- Additions to the five original categories (2026-08-06): net-new firms
-- researched to broaden deep tech / climate / energy / defence / biotech
-- coverage, using the same UK/EU-weighted, pre-seed/seed/Series-A criteria
-- as the block above. Web-verified for current activity (not defunct, not
-- growth/late-stage-only) wherever it was past confident-knowledge
-- territory. Defence is deliberately short (5, not 8-12): most 2025-2026
-- European defence-tech capital is flowing into growth-stage vehicles
-- (DTCP's Project Liberty, Earlybird/AVP's E2D) that don't fit this
-- filter's stage requirement, so the early-stage bench is genuinely
-- thinner than the other categories, not under-researched.

insert into investors (name, sectors, region) values
  -- deep tech
  ('LocalGlobe', array['deep tech'], 'UK'),
  ('Hoxton Ventures', array['deep tech'], 'UK'),
  ('Passion Capital', array['deep tech'], 'UK'),
  ('Isomer Capital', array['deep tech'], 'UK'),
  ('Kindred Capital', array['deep tech'], 'UK'),
  ('Notion Capital', array['deep tech'], 'UK'),
  ('Crane Venture Partners', array['deep tech'], 'UK'),
  ('Elaia Partners', array['deep tech','biotech'], 'EU'),
  ('UVC Partners', array['deep tech','climate'], 'EU'),
  ('Verve Ventures', array['deep tech'], 'EU'),
  -- climate
  ('AENU', array['climate'], 'EU'),
  ('Norrsken VC', array['climate'], 'EU'),
  ('Climentum Capital', array['climate'], 'EU'),
  ('Rubio Impact Ventures', array['climate'], 'EU'),
  ('Emerald Technology Ventures', array['climate'], 'EU'),
  ('Katapult Ocean', array['climate'], 'EU'),
  ('Übermorgen Ventures', array['climate'], 'EU'),
  ('Planet First Partners', array['climate'], 'UK'),
  -- energy
  ('SET Ventures', array['energy','climate'], 'EU'),
  ('EIT InnoEnergy', array['energy'], 'EU'),
  ('Future Energy Ventures', array['energy'], 'EU'),
  ('bp ventures', array['energy'], 'UK'),
  ('Shell Ventures', array['energy'], 'UK'),
  ('Equinor Ventures', array['energy'], 'EU'),
  ('TotalEnergies Ventures', array['energy'], 'EU'),
  ('Energy Revolution Ventures', array['energy','climate'], 'UK'),
  -- defence
  ('Rockaway Ventures', array['defence','deep tech'], 'EU'),
  ('Safran Corporate Ventures', array['defence'], 'EU'),
  ('Airbus Ventures', array['defence','deep tech'], 'EU'),
  ('Angel One', array['defence'], 'EU'),
  ('European Innovation Council (EIC) Fund', array['defence','deep tech'], 'EU'),
  -- biotech
  ('SV Health Investors', array['biotech'], 'UK'),
  ('Advent Life Sciences', array['biotech'], 'UK'),
  ('Epidarex Capital', array['biotech'], 'UK'),
  ('Ysios Capital', array['biotech'], 'EU'),
  ('Boehringer Ingelheim Venture Fund', array['biotech'], 'EU'),
  ('Roche Venture Fund', array['biotech'], 'EU'),
  ('Vesalius Biocapital Partners', array['biotech'], 'EU'),
  ('BiomedVC', array['biotech'], 'EU')
on conflict (name) do nothing;

-- Join Capital (already listed above under deep tech) is EIF-backed for
-- defence/dual-use deals too, per research on 2026-08-06 — re-tag rather
-- than re-insert (a no-op under on conflict do nothing).
update investors set sectors = array['deep tech','defence'] where name = 'Join Capital';
