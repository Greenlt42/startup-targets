-- Default "top-tier VC" list for deep tech / climate / defence / energy / biotech.
-- Starting point only — edit the `investors` table directly (or re-run this file)
-- to add/remove firms as you tune the filter.

insert into investors (name, sectors) values
  -- generalist / multi-sector top-tier
  ('a16z', array['deep tech','biotech','defence']),
  ('Founders Fund', array['deep tech','defence','energy']),
  ('Index Ventures', array['deep tech','biotech']),
  ('General Catalyst', array['deep tech','biotech','defence']),
  ('Sequoia Capital', array['deep tech','biotech']),
  ('Khosla Ventures', array['deep tech','climate','biotech']),
  ('Lux Capital', array['deep tech','defence','biotech']),
  ('Kleiner Perkins', array['deep tech','climate']),
  ('Accel', array['deep tech']),
  ('GV (Google Ventures)', array['deep tech','biotech']),
  ('Innovation Endeavors', array['deep tech']),
  ('8VC', array['deep tech','defence']),
  -- deep tech
  ('DCVC', array['deep tech','climate']),
  ('Playground Global', array['deep tech']),
  -- climate / energy
  ('Breakthrough Energy Ventures', array['climate','energy']),
  ('Lowercarbon Capital', array['climate','energy']),
  ('Energy Impact Partners', array['energy','climate']),
  ('Congruent Ventures', array['climate']),
  ('TDK Ventures', array['climate','deep tech']),
  ('Chevron Technology Ventures', array['energy']),
  -- defence
  ('Shield Capital', array['defence','deep tech']),
  ('In-Q-Tel', array['defence','deep tech']),
  ('Point72 Ventures', array['defence','deep tech']),
  ('Booz Allen Ventures', array['defence']),
  ('America''s Frontier Fund', array['defence','deep tech']),
  -- biotech
  ('ARCH Venture Partners', array['biotech']),
  ('Flagship Pioneering', array['biotech']),
  ('Third Rock Ventures', array['biotech']),
  ('OrbiMed', array['biotech']),
  ('Polaris Partners', array['biotech']),
  ('RA Capital Management', array['biotech'])
on conflict (name) do nothing;
