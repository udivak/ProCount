-- Track water alongside dated entries without making it a saved food.
-- Existing entries receive the non-null default `food` value automatically.
alter table profile
  add column water_goal_ml numeric not null default 3000
    check (water_goal_ml > 0);

alter table entries
  add column entry_kind text not null default 'food'
    check (entry_kind in ('food', 'water')),
  add column water_ml numeric
    check (water_ml is null or water_ml > 0),
  add constraint entries_water_shape_check check (
    (entry_kind = 'food' and water_ml is null)
    or
    (entry_kind = 'water' and water_ml is not null and protein_g = 0 and calories = 0 and food_id is null)
  );
