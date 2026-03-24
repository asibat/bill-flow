-- BillFlow seed data
-- The initial migration creates the core schema and seeds a small payee set.
-- This seed file expands the shared directory with common Belgian billers.

insert into public.payees (name, iban, bic, category, verified)
select name, iban, bic, category, verified
from (
  values
    ('Proximus', 'BE50 0003 2800 7424', 'BPOTBEB1', 'telecom', true),
    ('Telenet', 'BE08 7340 0000 1010', 'KREDBEBB', 'telecom', true),
    ('Orange Belgium', 'BE77 3100 7579 9795', 'BBRUBEBB', 'telecom', true),
    ('Engie', 'BE05 2100 0000 0444', 'GEBABEBB', 'utility', true),
    ('Luminus', 'BE97 3630 2800 0021', 'BBRUBEBB', 'utility', true),
    ('VIVAQUA', 'BE52 0960 1178 4309', 'GKCCBEBB', 'utility', true),
    ('De Watergroep', 'BE40 0000 2400 0220', 'BPOTBEB1', 'utility', true),
    ('Fluvius', 'BE91 0000 2700 3400', 'BPOTBEB1', 'utility', true),
    ('Ethias', 'BE89 0882 0000 0000', 'ETHIBEBB', 'insurance', true),
    ('AG Insurance', 'BE48 2100 0000 0010', 'GEBABEBB', 'insurance', true),
    ('Mutualite Chretienne', 'BE19 0000 9898 9898', 'BPOTBEB1', 'insurance', true),
    ('Partena Mutualite', 'BE56 2100 0066 8432', 'GEBABEBB', 'insurance', true),
    ('Belfius', null, null, 'other', false),
    ('BNP Paribas Fortis', null, null, 'other', false),
    ('ING Belgium', null, null, 'other', false),
    ('KBC Brussels', null, null, 'other', false),
    ('Farys', null, null, 'utility', false),
    ('Bruxelles Environnement', null, null, 'utility', false),
    ('Sibelga', null, null, 'utility', false),
    ('Lampiris', null, null, 'utility', false),
    ('TotalEnergies Power & Gas Belgium', null, null, 'utility', false),
    ('Ores', null, null, 'utility', false),
    ('SWDE', null, null, 'utility', false),
    ('Aquafin', null, null, 'utility', false),
    ('Securex', null, null, 'insurance', false),
    ('Helan', null, null, 'insurance', false),
    ('Solidaris', null, null, 'insurance', false),
    ('DKV Belgium', null, null, 'insurance', false),
    ('AXA Belgium', null, null, 'insurance', false),
    ('Vivium', null, null, 'insurance', false)
) as seed(name, iban, bic, category, verified)
where not exists (
  select 1
  from public.payees existing
  where lower(existing.name) = lower(seed.name)
);
