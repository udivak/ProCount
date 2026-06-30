-- 0004: entries record how many grams of food were eaten, so the detail modal can
-- derive protein-per-100g. Nullable — legacy and quick-add entries leave it null and
-- the UI shows "—" for amount and per-100g.

alter table entries add column if not exists grams numeric check (grams is null or grams >= 0);
