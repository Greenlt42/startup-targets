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
