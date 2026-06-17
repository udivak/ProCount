-- ProCount schema: foods, entries, profile.
-- Single user per account; RLS scopes every row to auth.uid(), so the app can talk
-- to Postgres directly through supabase-js without leaking across accounts.

create table foods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  unit        text,                            -- serving label shown in the UI ("ל-100 גרם", "יחידה")
  protein_g   numeric not null check (protein_g >= 0),
  calories    numeric not null check (calories >= 0),
  default_qty numeric not null default 1 check (default_qty > 0),
  created_at  timestamptz not null default now()
);

create table entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on   date not null,                         -- local date the client assigns the entry to
  name       text,
  protein_g  numeric not null check (protein_g >= 0),
  calories   numeric not null check (calories >= 0),
  source     text not null check (source in ('manual', 'saved', 'ai')),
  food_id    uuid references foods (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Supports the "today" query and the trends range scans (aggregate by eaten_on).
create index entries_user_eaten_on_idx on entries (user_id, eaten_on);

create table profile (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  protein_goal_g numeric not null default 160 check (protein_goal_g >= 0),
  ai_calls_date  date,                         -- server-side AI cost brake (consume_ai_call)
  ai_calls_count int not null default 0
);

-- RLS: one all-commands policy per table. (select auth.uid()) is wrapped so the
-- planner evaluates it once per query instead of per row, and `to authenticated`
-- skips the policy entirely for the anon role.
alter table foods   enable row level security;
alter table entries enable row level security;
alter table profile enable row level security;

create policy "own rows" on foods   for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on profile for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Atomically reserve one AI call against today's quota (UTC day). Returns true if
-- under the limit, false once spent. SECURITY INVOKER + RLS scope it to the caller's
-- own row, so it's not client-spoofable (unlike counting client-dated entries).
create function consume_ai_call(p_limit int)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ok boolean;
begin
  insert into public.profile (user_id) values ((select auth.uid()))
    on conflict (user_id) do nothing;

  update public.profile
    set ai_calls_count = case when ai_calls_date = current_date then ai_calls_count else 0 end + 1,
        ai_calls_date  = current_date
    where user_id = (select auth.uid())
      and (ai_calls_date is distinct from current_date or ai_calls_count < p_limit)
    returning true into ok;

  return coalesce(ok, false);
end;
$$;

-- ponytail: profile row is created by the client on first goal-save (upsert), not a
-- signup trigger — one fewer SECURITY DEFINER surface. Add a handle_new_user trigger
-- if you ever want a guaranteed row at signup.
