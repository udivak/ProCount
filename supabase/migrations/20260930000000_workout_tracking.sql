-- Personal workout plans and immutable session snapshots. All writes use the caller's RLS identity.
alter table public.profile add column workout_goal_weekly integer not null default 3 check (workout_goal_weekly between 1 and 14);

create table public.training_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  muscle_group text not null check (length(btrim(muscle_group)) between 1 and 80),
  equipment text,
  load_mode text not null default 'external' check (load_mode in ('external', 'bodyweight', 'assisted')),
  weight_basis text not null default 'total' check (weight_basis in ('total', 'per_hand')),
  reps_basis text not null default 'total' check (reps_basis in ('total', 'per_side')),
  notes text,
  archived_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  position integer not null default 0 check (position >= 0),
  preferred_day integer check (preferred_day between 0 and 6),
  revision integer not null default 1 check (revision > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position >= 0),
  target_sets jsonb not null default '[]'::jsonb check (jsonb_typeof(target_sets) = 'array'),
  rest_seconds integer not null default 60 check (rest_seconds between 0 and 3600),
  notes text,
  foreign key (template_id, user_id) references public.workout_templates(id, user_id),
  foreign key (exercise_id, user_id) references public.training_exercises(id, user_id),
  unique (template_id, position),
  unique (id, user_id)
);

create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id uuid not null,
  template_name text not null,
  performed_on date not null,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  partial boolean not null default false,
  notes text,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  foreign key (template_id, user_id) references public.workout_templates(id, user_id),
  unique (id, user_id)
);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position >= 0),
  exercise_name text not null,
  muscle_group text not null,
  equipment text,
  load_mode text not null check (load_mode in ('external', 'bodyweight', 'assisted')),
  weight_basis text not null check (weight_basis in ('total', 'per_hand')),
  reps_basis text not null check (reps_basis in ('total', 'per_side')),
  target_sets jsonb not null check (jsonb_typeof(target_sets) = 'array'),
  rest_seconds integer not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  revision integer not null default 1 check (revision > 0),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id),
  foreign key (exercise_id, user_id) references public.training_exercises(id, user_id),
  unique (session_id, position),
  unique (id, user_id)
);

create table public.workout_sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_exercise_id uuid not null,
  position integer not null check (position >= 0),
  kind text not null default 'work' check (kind in ('work', 'warmup')),
  load_kg numeric check (load_kg >= 0),
  reps integer not null check (reps > 0),
  note text,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  foreign key (session_exercise_id, user_id) references public.workout_session_exercises(id, user_id),
  unique (session_exercise_id, position),
  unique (id, user_id)
);

create index workout_templates_user_position_idx on public.workout_templates(user_id, archived_at, position);
create index training_exercises_user_name_idx on public.training_exercises(user_id, archived_at, name);
create index workout_sessions_user_date_idx on public.workout_sessions(user_id, performed_on desc, created_at desc);
create index workout_session_exercises_exercise_idx on public.workout_session_exercises(user_id, exercise_id, session_id);

alter table public.training_exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;

create policy "own rows" on public.training_exercises for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_templates for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_template_exercises for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_sessions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_session_exercises for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_sets for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.save_workout_template(p_id uuid, p_name text, p_position integer, p_preferred_day integer, p_items jsonb, p_expected_revision integer default 0)
returns public.workout_templates
language plpgsql security invoker set search_path = ''
as $$
declare
  v_row public.workout_templates;
  v_item jsonb;
  v_target jsonb;
begin
  if (select auth.uid()) is null or length(btrim(coalesce(p_name, ''))) not between 1 and 80
    or p_position < 0 or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_template';
  end if;
  if p_expected_revision = 0 then
    insert into public.workout_templates(id, name, position, preferred_day)
      values (p_id, btrim(p_name), p_position, p_preferred_day)
      on conflict (id) do nothing returning * into v_row;
    if v_row.id is null then
      select * into v_row from public.workout_templates where id = p_id and user_id = (select auth.uid());
      if v_row.id is null then raise exception 'template_conflict'; end if;
      return v_row; -- retry of the same creation id
    end if;
  else
    update public.workout_templates set name = btrim(p_name), position = p_position,
      preferred_day = p_preferred_day, revision = revision + 1
      where id = p_id and user_id = (select auth.uid()) and revision = p_expected_revision and archived_at is null
      returning * into v_row;
    if v_row.id is null then raise exception 'template_conflict'; end if;
    delete from public.workout_template_exercises where template_id = p_id and user_id = (select auth.uid());
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if not (v_item ? 'exercise_id') or jsonb_typeof(v_item->'target_sets') <> 'array'
      or jsonb_array_length(v_item->'target_sets') not between 1 and 20
      or coalesce((v_item->>'rest_seconds')::integer, 60) not between 0 and 3600 then
      raise exception 'invalid_template_item';
    end if;
    for v_target in select value from jsonb_array_elements(v_item->'target_sets') loop
      if jsonb_typeof(v_target) <> 'object'
        or not (v_target ? 'reps_min' and v_target ? 'reps_max')
        or jsonb_typeof(v_target->'reps_min') <> 'number'
        or jsonb_typeof(v_target->'reps_max') <> 'number'
        or (v_target->'load_kg' is not null and v_target->'load_kg' <> 'null'::jsonb
          and (jsonb_typeof(v_target->'load_kg') <> 'number' or (v_target->>'load_kg')::numeric < 0))
        or (v_target->>'reps_min')::integer < 1
        or (v_target->>'reps_max')::integer < (v_target->>'reps_min')::integer then
        raise exception 'invalid_target_set';
      end if;
    end loop;
    insert into public.workout_template_exercises(template_id, exercise_id, position, target_sets, rest_seconds, notes)
      values (p_id, (v_item->>'exercise_id')::uuid, (v_item->>'position')::integer,
        v_item->'target_sets', coalesce((v_item->>'rest_seconds')::integer, 60), v_item->>'notes');
  end loop;
  return v_row;
end;
$$;

create function public.start_workout(p_template_id uuid, p_session_id uuid, p_performed_on date, p_retroactive boolean default false)
returns public.workout_sessions
language plpgsql security invoker set search_path = ''
as $$
declare
  v_template public.workout_templates;
  v_session public.workout_sessions;
begin
  if (select auth.uid()) is null or p_performed_on is null then raise exception 'invalid_session'; end if;
  select * into v_session from public.workout_sessions where id = p_session_id and user_id = (select auth.uid());
  if v_session.id is not null then return v_session; end if;
  select * into v_template from public.workout_templates
    where id = p_template_id and user_id = (select auth.uid()) and archived_at is null for share;
  if v_template.id is null then raise exception 'template_not_found'; end if;
  insert into public.workout_sessions(id, template_id, template_name, performed_on, started_at)
    values (p_session_id, p_template_id, v_template.name, p_performed_on, case when p_retroactive then null else now() end)
    on conflict (id) do nothing returning * into v_session;
  if v_session.id is null then
    select * into v_session from public.workout_sessions where id = p_session_id and user_id = (select auth.uid());
    if v_session.id is null then raise exception 'session_conflict'; end if;
    return v_session;
  end if;
  insert into public.workout_session_exercises(session_id, exercise_id, position, exercise_name, muscle_group,
    equipment, load_mode, weight_basis, reps_basis, target_sets, rest_seconds, notes)
    select p_session_id, e.id, te.position, e.name, e.muscle_group, e.equipment, e.load_mode,
      e.weight_basis, e.reps_basis, te.target_sets, te.rest_seconds, coalesce(nullif(te.notes, ''), e.notes)
      from public.workout_template_exercises te join public.training_exercises e
        on e.id = te.exercise_id and e.user_id = te.user_id
      where te.template_id = p_template_id and te.user_id = (select auth.uid()) order by te.position;
  return v_session;
end;
$$;

create function public.save_workout_set(p_id uuid, p_session_exercise_id uuid, p_position integer,
  p_kind text, p_load_kg numeric, p_reps integer, p_note text, p_expected_revision integer default 0)
returns public.workout_sets
language plpgsql security invoker set search_path = ''
as $$
declare
  v_row public.workout_sets;
  v_mode text;
begin
  select se.load_mode into v_mode from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id and s.user_id = se.user_id
    where se.id = p_session_exercise_id and se.user_id = (select auth.uid()) and s.status <> 'cancelled';
  if v_mode is null or p_reps < 1 or p_kind not in ('work', 'warmup') or p_position < 0
    or p_load_kg < 0 or (v_mode <> 'bodyweight' and p_load_kg is null) then
    raise exception 'invalid_set';
  end if;
  if p_expected_revision = 0 then
    insert into public.workout_sets(id, session_exercise_id, position, kind, load_kg, reps, note)
      values (p_id, p_session_exercise_id, p_position, p_kind, p_load_kg, p_reps, p_note)
      on conflict (id) do nothing returning * into v_row;
    if v_row.id is null then
      select * into v_row from public.workout_sets where id = p_id and user_id = (select auth.uid());
      if v_row.id is null then raise exception 'set_conflict'; end if;
    end if;
  else
    update public.workout_sets set position = p_position, kind = p_kind, load_kg = p_load_kg,
      reps = p_reps, note = p_note, revision = revision + 1
      where id = p_id and user_id = (select auth.uid()) and revision = p_expected_revision
      returning * into v_row;
    if v_row.id is null then raise exception 'set_conflict'; end if;
  end if;
  return v_row;
end;
$$;

revoke all on function public.save_workout_template(uuid, text, integer, integer, jsonb, integer) from public;
revoke all on function public.start_workout(uuid, uuid, date, boolean) from public;
revoke all on function public.save_workout_set(uuid, uuid, integer, text, numeric, integer, text, integer) from public;
grant execute on function public.save_workout_template(uuid, text, integer, integer, jsonb, integer) to authenticated;
grant execute on function public.start_workout(uuid, uuid, date, boolean) to authenticated;
grant execute on function public.save_workout_set(uuid, uuid, integer, text, numeric, integer, text, integer) to authenticated;

-- Called only for the selected exercise and date range; the history list stays paged.
create function public.workout_progress(p_exercise_id uuid, p_since date, p_until date, p_template_id uuid default null)
returns table (session_id uuid, performed_on date, template_id uuid, template_name text,
  session_exercise_id uuid, load_mode text, weight_basis text, reps_basis text,
  set_id uuid, set_position integer, kind text, load_kg numeric, reps integer)
language sql security invoker set search_path = ''
as $$
  select s.id, s.performed_on, s.template_id, s.template_name, se.id, se.load_mode,
    se.weight_basis, se.reps_basis, ws.id, ws.position, ws.kind, ws.load_kg, ws.reps
  from public.workout_session_exercises se
  join public.workout_sessions s on s.id = se.session_id and s.user_id = se.user_id
  join public.workout_sets ws on ws.session_exercise_id = se.id and ws.user_id = se.user_id
  where se.user_id = (select auth.uid()) and se.exercise_id = p_exercise_id
    and s.status = 'completed' and s.performed_on between p_since and p_until
    and (p_template_id is null or s.template_id = p_template_id)
  order by s.performed_on, s.created_at, s.id, se.position, ws.position, ws.id;
$$;
revoke all on function public.workout_progress(uuid, date, date, uuid) from public;
grant execute on function public.workout_progress(uuid, date, date, uuid) to authenticated;

create function public.workout_previous(p_exercise_id uuid, p_before date, p_exclude_session_id uuid default null)
returns table (session_id uuid, performed_on date, set_id uuid, set_position integer,
  kind text, load_kg numeric, reps integer)
language sql security invoker set search_path = ''
as $$
  with latest as (
    select se.id, s.id as session_id, s.performed_on from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id and s.user_id = se.user_id
    where se.user_id = (select auth.uid()) and se.exercise_id = p_exercise_id
      and s.status = 'completed' and s.performed_on <= p_before
      and (p_exclude_session_id is null or s.id <> p_exclude_session_id)
    order by s.performed_on desc, s.created_at desc limit 1
  )
  select latest.session_id, latest.performed_on, ws.id, ws.position, ws.kind, ws.load_kg, ws.reps
    from latest join public.workout_sets ws on ws.session_exercise_id = latest.id
    order by ws.position;
$$;
revoke all on function public.workout_previous(uuid, date, uuid) from public;
grant execute on function public.workout_previous(uuid, date, uuid) to authenticated;
