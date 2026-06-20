-- 0002: foods becomes a shared catalog ("source of data") — no per-user ownership.
-- entries/profile stay per-user; only foods loses user_id. RLS now lets any
-- authenticated user read and write foods (single-user app, so effectively the owner).

drop policy "own rows" on foods;

alter table foods drop column user_id;

create policy "shared foods" on foods for all to authenticated
  using (true) with check (true);
