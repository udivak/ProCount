-- Bounded workout management; no direct OAuth table writes or implicit grant expansion.
alter table public.connector_permissions
 add column workout_catalog boolean not null default false,
 add column workout_edit boolean not null default false;

create table private.connector_workout_imports (
 user_id uuid not null references auth.users(id) on delete cascade,
 source_system text not null, source_workout_id text not null,
 session_id uuid not null, payload jsonb not null,
 primary key(user_id,source_system,source_workout_id),
 foreign key(session_id,user_id) references public.workout_sessions(id,user_id)
);
alter table private.connector_workout_imports enable row level security;
revoke all on private.connector_workout_imports from public,anon,authenticated;

create function private.connector_allowed(p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.connector_permissions g join auth.oauth_clients c on c.id=g.client_id
 where g.user_id=auth.uid() and g.client_id=(auth.jwt()->>'client_id')::uuid and c.deleted_at is null
 and case p_action when 'water' then g.water when 'meals' then g.meals when 'workouts' then g.workouts
 when 'save_exercise' then g.workout_catalog when 'save_workout_template' then g.workout_catalog
 when 'update_workout_session' then g.workout_edit when 'set_workout_session_status' then g.workout_edit else false end);
$$;
revoke all on function private.connector_allowed(text) from public,anon,authenticated;

create function private.connector_keys(p_value jsonb,p_keys text[]) returns void
language plpgsql set search_path='' as $$ begin
 if jsonb_typeof(p_value) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_value) k where not k=any(p_keys)) then
 raise exception 'invalid_fields'; end if;
end $$;
revoke all on function private.connector_keys(jsonb,text[]) from public,anon,authenticated;

create function private.connector_actual_set(p_value jsonb,p_mode text) returns void
language plpgsql set search_path='' as $$ begin
 if jsonb_typeof(p_value->'reps') is distinct from 'number' or (p_value->>'reps')::numeric not between 1 and 10000
 or (p_value->>'reps')::numeric<>trunc((p_value->>'reps')::numeric)
 or coalesce(p_value->>'kind','') not in ('work','warmup')
 or (p_mode<>'bodyweight' and (p_value->>'load_kg') is null)
 or ((p_value->>'load_kg') is not null and (jsonb_typeof(p_value->'load_kg')<>'number' or (p_value->>'load_kg')::numeric not between 0 and 10000))
 or length(coalesce(p_value->>'note',''))>1000 then raise exception 'invalid_set'; end if;
end $$;
revoke all on function private.connector_actual_set(jsonb,text) from public,anon,authenticated;

-- Private snapshots keep exact IDs/revisions; before/after results provide reversible set corrections.
create function private.connector_session(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select (to_jsonb(s)-'user_id') || jsonb_build_object('exercises',coalesce((
 select jsonb_agg((to_jsonb(e)-'user_id')||jsonb_build_object('sets',coalesce((
 select jsonb_agg(to_jsonb(st)-'user_id' order by st.position) from public.workout_sets st where st.session_exercise_id=e.id and st.user_id=auth.uid()),'[]'::jsonb)) order by e.position)
 from public.workout_session_exercises e where e.session_id=s.id and e.user_id=auth.uid()),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('source_system',i.source_system,'source_workout_id',i.source_workout_id)) from private.connector_workout_imports i where i.session_id=s.id and i.user_id=auth.uid()),'[]'::jsonb))
 from public.workout_sessions s where s.id=p_id and s.user_id=auth.uid();
$$;
revoke all on function private.connector_session(uuid) from public,anon,authenticated;

-- All creation/date/status paths, including the PWA, share the same same-day lock.
create function private.workout_duplicate_guard() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if new.status='cancelled' then return new; end if;
 if tg_op='UPDATE' and old.status<>'cancelled' and old.user_id=new.user_id and old.template_id=new.template_id and old.performed_on=new.performed_on then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||':'||new.template_id::text||':'||new.performed_on::text,0));
 if current_setting('procount.allow_same_day',true) is distinct from 'true' and exists(
 select 1 from public.workout_sessions s where s.user_id=new.user_id and s.template_id=new.template_id
 and s.performed_on=new.performed_on and s.id<>new.id and s.status<>'cancelled') then
 raise exception 'possible_duplicate_workout' using hint='Read the existing sessions; explicitly allow only a distinct second workout.';
 end if;
 return new;
end $$;
revoke all on function private.workout_duplicate_guard() from public,anon,authenticated;
create trigger workout_duplicate_guard before insert or update of performed_on,template_id,status on public.workout_sessions
 for each row execute function private.workout_duplicate_guard();


-- Parent locks make first-party set/status writes serialize with connector corrections and cancellation.
create or replace function public.save_workout_set(p_id uuid, p_session_exercise_id uuid, p_position integer,
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
    where se.id = p_session_exercise_id and se.user_id = (select auth.uid()) and s.status <> 'cancelled' for update of s;
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

create function public.set_workout_exercise_status(p_id uuid,p_status text,p_expected_revision integer)
returns public.workout_session_exercises language plpgsql security invoker set search_path='' as $$
declare s public.workout_sessions; e public.workout_session_exercises;
begin
 select ws.* into s from public.workout_sessions ws join public.workout_session_exercises se on se.session_id=ws.id and se.user_id=ws.user_id
 where se.id=p_id and se.user_id=auth.uid() for update of ws;
 if not found or s.status='cancelled' or p_status not in ('completed','skipped') then raise exception 'workout_not_editable'; end if;
 update public.workout_session_exercises set status=p_status,revision=revision+1
 where id=p_id and user_id=auth.uid() and revision=p_expected_revision returning * into e;
 if not found then raise exception 'exercise_conflict'; end if;
 return e;
end $$;
revoke all on function public.set_workout_exercise_status(uuid,text,integer) from public,anon;
grant execute on function public.set_workout_exercise_status(uuid,text,integer) to authenticated;

-- Restoring a removed UUID must never recycle an old version held by an open UI editor.
create table private.connector_removed_sets (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 revision integer not null, snapshot jsonb not null
);
alter table private.connector_removed_sets enable row level security;
revoke all on private.connector_removed_sets from public,anon,authenticated;
create function private.workout_set_version_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_revision integer; previous_user uuid;
begin
 if tg_op='DELETE' then
  -- Account deletion already removes this owner's private audit rows.
  if not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
  insert into private.connector_removed_sets(id,user_id,revision,snapshot) values(old.id,old.user_id,old.revision,to_jsonb(old)-'user_id')
   on conflict(id) do update set revision=greatest(connector_removed_sets.revision,excluded.revision),snapshot=excluded.snapshot;
  return old;
 end if;
 select revision,user_id into previous_revision,previous_user from private.connector_removed_sets where id=new.id;
 if found and previous_user<>new.user_id then raise exception 'set_conflict'; end if;
 if found then new.revision:=greatest(new.revision,previous_revision+1); end if;
 return new;
end $$;
revoke all on function private.workout_set_version_guard() from public,anon,authenticated;
create trigger workout_set_version_guard before insert or delete on public.workout_sets for each row execute function private.workout_set_version_guard();

-- Keep the already-tested meal/water implementation; the old entry point is internal only.
alter function private.connector_write(uuid,text,jsonb) rename to connector_write_logging;
revoke all on function private.connector_write_logging(uuid,text,jsonb) from public,anon,authenticated;

create function private.connector_write(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); c uuid:=(auth.jwt()->>'client_id')::uuid; old private.connector_requests;
 r jsonb; before_state jsonb; item jsonb; st jsonb; merged jsonb; d date;
 sess public.workout_sessions; ex public.workout_session_exercises; ws public.workout_sets;
 imported private.connector_workout_imports; template public.workout_templates; exercise public.training_exercises;
 target jsonb; canonical jsonb; sid uuid; n integer; seen uuid[]; affected uuid[]:='{}';
 old_allow text:=current_setting('procount.allow_same_day',true);
begin
 if u is null or c is null or p_request_id is null or p_action is null or p_payload is null
 or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then raise exception 'invalid_request'; end if;
 if not private.connector_allowed(p_action) then raise exception 'connector_write_not_authorized'; end if;
 if p_action in ('water','meals') then return private.connector_write_logging(p_request_id,p_action,p_payload); end if;
 insert into private.connector_requests(user_id,client_id,request_id,action,payload) values(u,c,p_request_id,p_action,p_payload) on conflict do nothing;
 select * into old from private.connector_requests where user_id=u and client_id=c and request_id=p_request_id for update;
 if old.action<>p_action or old.payload<>p_payload then raise exception 'request_id_conflict'; end if;
 if old.result is not null then return old.result; end if;
 if p_payload ? 'allow_same_day_session' and jsonb_typeof(p_payload->'allow_same_day_session')<>'boolean' then raise exception 'invalid_fields'; end if;
 perform set_config('procount.allow_same_day',coalesce(p_payload->>'allow_same_day_session','false'),true);
 if p_action='workouts' then
   perform private.connector_keys(p_payload,array['date','template_id','notes','exercises','source_system','source_workout_id','expected_template_revision','allow_same_day_session']);
   if coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
   d:=(p_payload->>'date')::date;
   if d>(now() at time zone 'Asia/Jerusalem')::date then raise exception 'future_date'; end if;
   if (p_payload ? 'source_system')<>(p_payload ? 'source_workout_id') then raise exception 'invalid_source'; end if;
   canonical:=p_payload-array['source_system','source_workout_id','expected_template_revision','allow_same_day_session'];
   if p_payload ? 'source_system' then
     if length(btrim(coalesce(p_payload->>'source_system',''))) not between 1 and 80 or length(btrim(coalesce(p_payload->>'source_workout_id',''))) not between 1 and 200 then raise exception 'invalid_source'; end if;
     perform pg_advisory_xact_lock(hashtextextended(u::text||':source:'||(p_payload->>'source_system')||':'||(p_payload->>'source_workout_id'),0));
     select * into imported from private.connector_workout_imports where user_id=u and source_system=p_payload->>'source_system' and source_workout_id=p_payload->>'source_workout_id';
     if found then
       if imported.payload<>canonical then raise exception 'source_payload_conflict'; end if;
       r:=jsonb_build_object('session',private.connector_session(imported.session_id),'already_imported',true);
     end if;
   end if;
   if r is null then
     select * into template from public.workout_templates where id=(p_payload->>'template_id')::uuid and user_id=u and archived_at is null for share;
     if not found then raise exception 'template_not_found'; end if;
     if p_payload ? 'expected_template_revision' and (jsonb_typeof(p_payload->'expected_template_revision')<>'number' or (p_payload->>'expected_template_revision')::numeric<>template.revision) then raise exception 'template_conflict'; end if;
     if jsonb_typeof(p_payload->'exercises') is distinct from 'array' or jsonb_array_length(p_payload->'exercises') not between 1 and 50 or length(coalesce(p_payload->>'notes',''))>1000 then raise exception 'invalid_workout'; end if;
     for item in select value from jsonb_array_elements(p_payload->'exercises') loop
       perform private.connector_keys(item,array['exercise_id','sets']);
       select e.* into exercise from public.training_exercises e join public.workout_template_exercises te on te.exercise_id=e.id and te.user_id=e.user_id
        where te.template_id=template.id and e.id=(item->>'exercise_id')::uuid and e.user_id=u limit 1 for share of e;
       if not found or jsonb_typeof(item->'sets') is distinct from 'array' or jsonb_array_length(item->'sets') not between 1 and 50 then raise exception 'invalid_exercise'; end if;
       for st in select value from jsonb_array_elements(item->'sets') loop
         perform private.connector_keys(st,array['reps','load_kg','kind','note']);
         perform private.connector_actual_set(jsonb_build_object('kind','work')||st,exercise.load_mode);
       end loop;
     end loop;
     r:=private.connector_write_logging(p_request_id,p_action,p_payload);
     sid:=(r->'session'->>'id')::uuid;
     if p_payload ? 'source_system' then
       insert into private.connector_workout_imports values(u,p_payload->>'source_system',p_payload->>'source_workout_id',sid,canonical);
     end if;
     r:=jsonb_build_object('session',private.connector_session(sid),'already_imported',false);
   end if;
 elsif p_action='save_exercise' then
   perform private.connector_keys(p_payload,array['id','expected_revision','name','muscle_group','equipment','notes','load_mode','weight_basis','reps_basis']);
   if coalesce(p_payload->>'expected_revision','') !~ '^\d+$' or length(btrim(coalesce(p_payload->>'name',''))) not between 1 and 120
    or length(btrim(coalesce(p_payload->>'muscle_group',''))) not between 1 and 80 or length(coalesce(p_payload->>'equipment',''))>200 or length(coalesce(p_payload->>'notes',''))>1000
    or coalesce(p_payload->>'load_mode','') not in ('external','bodyweight','assisted') or coalesce(p_payload->>'weight_basis','') not in ('total','per_hand') or coalesce(p_payload->>'reps_basis','') not in ('total','per_side') then raise exception 'invalid_exercise'; end if;
   if (p_payload->>'expected_revision')::integer=0 then
     insert into public.training_exercises(id,user_id,name,muscle_group,equipment,notes,load_mode,weight_basis,reps_basis)
      values((p_payload->>'id')::uuid,u,btrim(p_payload->>'name'),btrim(p_payload->>'muscle_group'),p_payload->>'equipment',p_payload->>'notes',p_payload->>'load_mode',p_payload->>'weight_basis',p_payload->>'reps_basis') returning * into exercise;
   else
     select * into exercise from public.training_exercises where id=(p_payload->>'id')::uuid and user_id=u and archived_at is null for update;
     if not found or exercise.revision<>(p_payload->>'expected_revision')::integer then raise exception 'exercise_conflict'; end if;
     before_state:=to_jsonb(exercise)-'user_id';
     update public.training_exercises set name=btrim(p_payload->>'name'),muscle_group=btrim(p_payload->>'muscle_group'),equipment=p_payload->>'equipment',notes=p_payload->>'notes',
      load_mode=p_payload->>'load_mode',weight_basis=p_payload->>'weight_basis',reps_basis=p_payload->>'reps_basis',revision=revision+1 where id=exercise.id and user_id=u returning * into exercise;
   end if;
   r:=jsonb_build_object('exercise',to_jsonb(exercise)-'user_id');
 elsif p_action='save_workout_template' then
   perform private.connector_keys(p_payload,array['id','expected_revision','name','position','preferred_day','items']);
   if coalesce(p_payload->>'expected_revision','') !~ '^\d+$' or coalesce(p_payload->>'position','') !~ '^\d+$' or (p_payload->>'position')::numeric>1000
    or length(btrim(coalesce(p_payload->>'name',''))) not between 1 and 80 or not p_payload ? 'preferred_day'
    or ((p_payload->>'preferred_day') is not null and (p_payload->>'preferred_day') !~ '^[0-6]$')
    or jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 50 then raise exception 'invalid_template'; end if;
   if (p_payload->>'expected_revision')::integer=0 then
     if exists(select 1 from public.workout_templates where id=(p_payload->>'id')::uuid) then raise exception 'template_conflict'; end if;
   else
     select * into template from public.workout_templates where id=(p_payload->>'id')::uuid and user_id=u and archived_at is null for update;
     if not found or template.revision<>(p_payload->>'expected_revision')::integer then raise exception 'template_conflict'; end if;
     before_state:=to_jsonb(template)-'user_id';
   end if;
   for item in select value from jsonb_array_elements(p_payload->'items') loop
     perform private.connector_keys(item,array['exercise_id','position','rest_seconds','notes','target_sets']);
     if not exists(select 1 from public.training_exercises where id=(item->>'exercise_id')::uuid and user_id=u and archived_at is null)
       or coalesce(item->>'position','') !~ '^\d+$' or (item->>'position')::numeric>1000 or coalesce(item->>'rest_seconds','') !~ '^\d+$' or (item->>'rest_seconds')::numeric>3600
       or length(coalesce(item->>'notes',''))>1000 or jsonb_typeof(item->'target_sets') is distinct from 'array' or jsonb_array_length(item->'target_sets') not between 1 and 20 then raise exception 'invalid_template_item'; end if;
     for target in select value from jsonb_array_elements(item->'target_sets') loop
       perform private.connector_keys(target,array['reps_min','reps_max','load_kg']);
       if coalesce(target->>'reps_min','') !~ '^\d+$' or coalesce(target->>'reps_max','') !~ '^\d+$' or (target->>'reps_min')::numeric not between 1 and 10000 or (target->>'reps_max')::numeric not between (target->>'reps_min')::numeric and 10000
        or ((target->>'load_kg') is not null and (jsonb_typeof(target->'load_kg')<>'number' or (target->>'load_kg')::numeric not between 0 and 10000)) then raise exception 'invalid_target_set'; end if;
     end loop;
   end loop;
   template:=public.save_workout_template((p_payload->>'id')::uuid,p_payload->>'name',(p_payload->>'position')::integer,(p_payload->>'preferred_day')::integer,p_payload->'items',(p_payload->>'expected_revision')::integer);
   r:=jsonb_build_object('template',to_jsonb(template)-'user_id','items',p_payload->'items');
 elsif p_action in ('update_workout_session','set_workout_session_status') then
   if p_action='update_workout_session' then
     perform private.connector_keys(p_payload,array['session_id','expected_revision','date','notes','exercises','sets','allow_same_day_session']);
     if not (p_payload ?| array['date','notes','exercises','sets']) then raise exception 'no_changes'; end if;
   else
     perform private.connector_keys(p_payload,array['session_id','expected_revision','status','allow_same_day_session']);
     if coalesce(p_payload->>'status','') not in ('completed','cancelled') then raise exception 'invalid_status'; end if;
   end if;
   select * into sess from public.workout_sessions where id=(p_payload->>'session_id')::uuid and user_id=u for update;
   if not found or coalesce(p_payload->>'expected_revision','') !~ '^[1-9]\d*$' or sess.revision<>(p_payload->>'expected_revision')::integer then raise exception 'session_conflict'; end if;
   -- Lock children before taking the audit snapshot; UI set writes do not change session revision.
   perform 1 from public.workout_session_exercises where session_id=sess.id and user_id=u order by id for update;
   perform 1 from public.workout_sets where user_id=u and session_exercise_id in(select id from public.workout_session_exercises where session_id=sess.id and user_id=u) order by id for update;
   before_state:=private.connector_session(sess.id);
   if p_action='set_workout_session_status' then
     if sess.status not in ('completed','cancelled') or sess.status=p_payload->>'status' then raise exception 'invalid_status_transition'; end if;
     update public.workout_sessions set status=p_payload->>'status',revision=revision+1 where id=sess.id and user_id=u;
   else
     if sess.status<>'completed' then raise exception 'workout_not_completed'; end if;
     if p_payload ? 'date' then
       if coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
       d:=(p_payload->>'date')::date;
       if d>(now() at time zone 'Asia/Jerusalem')::date then raise exception 'future_date'; end if;
     else d:=sess.performed_on; end if;
     if length(coalesce(p_payload->>'notes',''))>1000 then raise exception 'invalid_notes'; end if;
     if p_payload ? 'exercises' then
       if jsonb_typeof(p_payload->'exercises')<>'array' or jsonb_array_length(p_payload->'exercises') not between 1 and 50 then raise exception 'invalid_exercises'; end if;
       seen:='{}';
       for item in select value from jsonb_array_elements(p_payload->'exercises') loop
         perform private.connector_keys(item,array['id','expected_revision','status']);
         select * into ex from public.workout_session_exercises where id=(item->>'id')::uuid and session_id=sess.id and user_id=u;
         if not found or ex.id=any(seen) or coalesce(item->>'expected_revision','') !~ '^[1-9]\d*$' or ex.revision<>(item->>'expected_revision')::integer or coalesce(item->>'status','') not in ('completed','skipped') then raise exception 'exercise_conflict'; end if;
         seen:=array_append(seen,ex.id); affected:=array_append(affected,ex.id);
       end loop;
     end if;
     if p_payload ? 'sets' then
       if jsonb_typeof(p_payload->'sets')<>'array' or jsonb_array_length(p_payload->'sets') not between 1 and 250 then raise exception 'invalid_sets'; end if;
       seen:='{}';
       for item in select value from jsonb_array_elements(p_payload->'sets') loop
         perform private.connector_keys(item,array['id','expected_revision','session_exercise_id','expected_exercise_revision','position','remove','reps','load_kg','kind','note']);
         select * into ex from public.workout_session_exercises where id=(item->>'session_exercise_id')::uuid and session_id=sess.id and user_id=u;
         if not found or coalesce(item->>'expected_exercise_revision','') !~ '^[1-9]\d*$' or ex.revision<>(item->>'expected_exercise_revision')::integer then raise exception 'exercise_conflict'; end if;
         if (item->>'id')::uuid=any(seen) or coalesce(item->>'expected_revision','') !~ '^\d+$' then raise exception 'set_conflict'; end if;
         seen:=array_append(seen,(item->>'id')::uuid); affected:=array_append(affected,ex.id);
         select * into ws from public.workout_sets where id=(item->>'id')::uuid and session_exercise_id=ex.id and user_id=u;
         if (item->>'expected_revision')::integer=0 then
           if found or exists(select 1 from public.workout_sets where id=(item->>'id')::uuid) or coalesce(item->>'remove','false')<>'false' then raise exception 'set_conflict'; end if;
           merged:=item;
         else
           if not found or ws.revision<>(item->>'expected_revision')::integer then raise exception 'set_conflict'; end if;
           merged:=to_jsonb(ws)||item;
         end if;
         if item ? 'remove' and jsonb_typeof(item->'remove')<>'boolean' then raise exception 'invalid_set'; end if;
         if coalesce(item->>'remove','false')='true' then
           if item ?| array['position','reps','load_kg','kind','note'] then raise exception 'invalid_set'; end if;
           delete from public.workout_sets where id=ws.id and user_id=u;
         else
           perform private.connector_actual_set(merged,ex.load_mode);
           if coalesce(merged->>'position','') !~ '^\d+$' or (merged->>'position')::numeric>1000 then raise exception 'invalid_set'; end if;
           perform public.save_workout_set((item->>'id')::uuid,ex.id,(merged->>'position')::integer,merged->>'kind',(merged->>'load_kg')::numeric,(merged->>'reps')::integer,merged->>'note',(item->>'expected_revision')::integer);
         end if;
       end loop;
     end if;
     if p_payload ? 'exercises' then
       for item in select value from jsonb_array_elements(p_payload->'exercises') loop
         update public.workout_session_exercises set status=item->>'status' where id=(item->>'id')::uuid and user_id=u;
       end loop;
     end if;
     update public.workout_session_exercises set revision=revision+1 where id=any(affected) and user_id=u;
     update public.workout_sessions set performed_on=d,notes=case when p_payload ? 'notes' then p_payload->>'notes' else notes end,
       partial=exists(select 1 from public.workout_session_exercises e where e.session_id=sess.id and e.user_id=u and (e.status<>'completed' or exists(select 1 from generate_series(0,greatest(jsonb_array_length(e.target_sets),1)-1) pos where not exists(select 1 from public.workout_sets s where s.session_exercise_id=e.id and s.user_id=u and s.position=pos)))),
       revision=revision+1 where id=sess.id and user_id=u;
   end if;
   r:=jsonb_build_object('session',private.connector_session(sess.id));
 else raise exception 'invalid_action'; end if;
 perform set_config('procount.allow_same_day',coalesce(old_allow,'false'),true);
 r:=r||jsonb_build_object('saved',true,'request_id',p_request_id,'before',before_state);
 update private.connector_requests set result=r where user_id=u and client_id=c and request_id=p_request_id;
 return r;
end $$;
revoke all on function private.connector_write(uuid,text,jsonb) from public,anon;
grant execute on function private.connector_write(uuid,text,jsonb) to authenticated;
-- Rebind the existing public wrapper after renaming its former implementation.
create or replace function public.connector_write(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.connector_write(p_request_id,p_action,p_payload); $$;

create function private.connector_read(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c uuid:=(auth.jwt()->>'client_id')::uuid; r jsonb; req private.connector_requests;
begin
 if u is null or c is null or not exists(select 1 from auth.oauth_clients where id=c and deleted_at is null)
  or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1024 then raise exception 'invalid_request'; end if;
 if p_action='capabilities' then
   perform private.connector_keys(p_payload,'{}');
   return jsonb_build_object('version','1.2.0','permissions',jsonb_build_object(
    'water',private.connector_allowed('water'),'meals',private.connector_allowed('meals'),'workouts',private.connector_allowed('workouts'),
    'workout_catalog',private.connector_allowed('save_exercise'),'workout_edit',private.connector_allowed('update_workout_session')),
    'actions',jsonb_build_array('log_water','log_meal','log_workout','save_exercise','save_workout_template','update_workout_session','set_workout_session_status','get_workout_session','get_write_result','get_connector_capabilities'),
    'limits',jsonb_build_object('payload_bytes',65536,'exercises',50,'sets_per_exercise',50,'set_patches',250));
 elsif p_action='session' then
   perform private.connector_keys(p_payload,array['session_id']);
   r:=private.connector_session((p_payload->>'session_id')::uuid);
   if r is null then raise exception 'session_not_found'; end if;
   return r;
 elsif p_action='result' then
   perform private.connector_keys(p_payload,array['request_id']);
   select * into req from private.connector_requests where user_id=u and client_id=c and request_id=(p_payload->>'request_id')::uuid;
   if not found then return jsonb_build_object('found',false,'request_id',p_payload->>'request_id'); end if;
   if not private.connector_allowed(req.action) then raise exception 'connector_write_not_authorized'; end if;
   return jsonb_build_object('found',true,'result',req.result);
 else raise exception 'invalid_action'; end if;
end $$;
revoke all on function private.connector_read(text,jsonb) from public,anon;
grant execute on function private.connector_read(text,jsonb) to authenticated;
create function public.connector_read(p_action text,p_payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.connector_read(p_action,p_payload); $$;
revoke all on function public.connector_read(text,jsonb) from public,anon;
grant execute on function public.connector_read(text,jsonb) to authenticated;

create or replace function private.connector_clients() returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or auth.jwt()->>'client_id' is not null then raise exception 'first_party_only'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('client_id',c.id,'client_name',c.client_name,
 'water',coalesce(g.water,false),'meals',coalesce(g.meals,false),'workouts',coalesce(g.workouts,false),
 'workout_catalog',coalesce(g.workout_catalog,false),'workout_edit',coalesce(g.workout_edit,false)))
 from auth.oauth_consents a join auth.oauth_clients c on c.id=a.client_id left join public.connector_permissions g on g.user_id=a.user_id and g.client_id=c.id
 where a.user_id=auth.uid() and a.revoked_at is null and c.deleted_at is null),'[]'::jsonb);
end $$;
