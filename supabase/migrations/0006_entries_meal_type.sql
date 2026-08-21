-- Entries are explicitly grouped into the four meal sections shown on the Today screen.
-- Existing entries default to snack so historical logging stays visible without guessing.

alter table entries
  add column if not exists meal_type text not null default 'snack'
  check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));
