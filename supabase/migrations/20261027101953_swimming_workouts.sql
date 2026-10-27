-- Pool swimming is a completed summary, never fake strength exercises/sets.
alter table public.workout_templates add column kind text not null default 'strength' check (kind in ('strength','swimming'));
alter table public.workout_sessions add column kind text not null default 'strength' check (kind in ('strength','swimming'));
create unique index workout_one_swim_template on public.workout_templates(user_id) where kind='swimming';

create table public.workout_swim_details (
 session_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 duration_seconds integer not null check (duration_seconds between 1 and 86400),
 distance_m numeric check (distance_m>0 and distance_m<=100000),
 pool_length_m numeric check (pool_length_m>0 and pool_length_m<=200),
 length_count integer check (length_count>0),
 stroke text check (stroke in ('freestyle','breaststroke','backstroke','butterfly','mixed')),
 unique(session_id,user_id),
 foreign key(session_id,user_id) references public.workout_sessions(id,user_id) on delete cascade,
 check ((pool_length_m is null and length_count is null) or
  (pool_length_m is not null and length_count is not null and distance_m is not null and distance_m=round(pool_length_m*length_count,2)))
);
alter table public.workout_swim_details enable row level security;
create policy "own swimming reads" on public.workout_swim_details for select to authenticated using (user_id=(select auth.uid()));
revoke all on public.workout_swim_details from public,anon,authenticated;
grant select on public.workout_swim_details to authenticated;

-- First-party swimming RPCs own all swim mutations, including date and status.
do $$ declare t text; begin
 foreach t in array array['workout_templates','workout_sessions'] loop
  execute format('create policy "swim insert via rpc" on public.%I as restrictive for insert to authenticated with check (kind=''strength'')',t);
  execute format('create policy "swim update via rpc" on public.%I as restrictive for update to authenticated using (kind=''strength'') with check (kind=''strength'')',t);
  execute format('create policy "swim delete via rpc" on public.%I as restrictive for delete to authenticated using (kind=''strength'')',t);
 end loop;
end $$;

create table private.swim_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, payload jsonb not null, result jsonb,
 primary key(user_id,request_id)
);
alter table private.swim_requests enable row level security;
revoke all on private.swim_requests from public,anon,authenticated;

create function private.swim_write(p_request_id uuid,p_session_id uuid,p_expected_revision integer,
 p_action text,p_date date,p_swim jsonb,p_notes text,p_timezone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); payload jsonb; previous private.swim_requests; s public.workout_sessions;
 t public.workout_templates; details public.workout_swim_details; local_today date; v_result jsonb;
begin
 if u is null or auth.jwt()->>'client_id' is not null then raise exception 'first_party_only'; end if;
 if p_request_id is null or p_session_id is null or p_expected_revision is null or p_expected_revision<0
  or p_action is null or p_action not in ('save','cancelled','completed') then raise exception 'invalid_request'; end if;
 payload:=jsonb_build_object('session_id',p_session_id,'expected_revision',p_expected_revision,'action',p_action,
  'date',p_date,'swim',p_swim,'notes',p_notes,'timezone',p_timezone);
 if octet_length(payload::text)>4096 then raise exception 'invalid_request'; end if;
 insert into private.swim_requests(user_id,request_id,payload) values(u,p_request_id,payload) on conflict do nothing;
 select * into previous from private.swim_requests where user_id=u and request_id=p_request_id for update;
 if previous.payload<>payload then raise exception 'request_id_conflict'; end if;
 if previous.result is not null then return previous.result; end if;

 if p_action='save' then
  if p_timezone is null or length(p_timezone)>100 or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'invalid_timezone'; end if;
  local_today:=(now() at time zone p_timezone)::date;
  if p_date is null or p_date>local_today then raise exception 'invalid_date'; end if;
  if length(coalesce(p_notes,''))>1000 or jsonb_typeof(p_swim) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(p_swim) k where not k=any(array['duration_seconds','distance_m','pool_length_m','length_count','stroke']))
   or jsonb_typeof(p_swim->'duration_seconds') is distinct from 'number'
   or (p_swim->>'duration_seconds')::numeric not between 1 and 86400
   or (p_swim->>'duration_seconds')::numeric<>trunc((p_swim->>'duration_seconds')::numeric)
   or ((p_swim->>'distance_m') is not null and (jsonb_typeof(p_swim->'distance_m')<>'number' or (p_swim->>'distance_m')::numeric not between 0.01 and 100000))
   or ((p_swim->>'pool_length_m') is not null and (jsonb_typeof(p_swim->'pool_length_m')<>'number' or (p_swim->>'pool_length_m')::numeric not between 0.01 and 200))
   or ((p_swim->>'length_count') is not null and (jsonb_typeof(p_swim->'length_count')<>'number' or (p_swim->>'length_count')::numeric not between 1 and 10000000 or (p_swim->>'length_count')::numeric<>trunc((p_swim->>'length_count')::numeric)))
   or ((p_swim->>'stroke') is not null and (jsonb_typeof(p_swim->'stroke')<>'string' or p_swim->>'stroke' not in ('freestyle','breaststroke','backstroke','butterfly','mixed')))
   or ((p_swim->>'pool_length_m') is null)<>((p_swim->>'length_count') is null)
   or ((p_swim->>'pool_length_m') is not null and ((p_swim->>'distance_m') is null or (p_swim->>'distance_m')::numeric<>round((p_swim->>'pool_length_m')::numeric*(p_swim->>'length_count')::numeric,2)))
   then raise exception 'invalid_swim'; end if;
 end if;

 -- A stable session lock also serializes two distinct request IDs creating it.
 perform pg_advisory_xact_lock(hashtextextended(u::text||':swim:'||p_session_id::text,0));
 select * into s from public.workout_sessions where id=p_session_id and user_id=u for update;
 if p_expected_revision=0 then
  if p_action<>'save' or found or exists(select 1 from public.workout_sessions where id=p_session_id) then raise exception 'session_conflict'; end if;
  insert into public.workout_templates(user_id,name,position,kind) values(u,'שחייה',0,'swimming')
   on conflict(user_id) where kind='swimming' do update set name=workout_templates.name returning * into t;
  insert into public.workout_sessions(id,user_id,template_id,template_name,performed_on,status,kind,notes)
   values(p_session_id,u,t.id,t.name,p_date,'completed','swimming',nullif(btrim(p_notes),'')) returning * into s;
 else
  if not found or s.kind<>'swimming' or s.revision<>p_expected_revision then raise exception 'session_conflict'; end if;
  if p_action='save' and s.status<>'completed' then raise exception 'workout_not_editable'; end if;
  if p_action<>'save' and (s.status not in ('completed','cancelled') or s.status=p_action) then raise exception 'invalid_status_transition'; end if;
  update public.workout_sessions set performed_on=case when p_action='save' then p_date else performed_on end,
   notes=case when p_action='save' then nullif(btrim(p_notes),'') else notes end,
   status=case when p_action='save' then status else p_action end,revision=revision+1
   where id=s.id and user_id=u returning * into s;
 end if;
 if p_action='save' then
  insert into public.workout_swim_details(session_id,user_id,duration_seconds,distance_m,pool_length_m,length_count,stroke)
   values(s.id,u,(p_swim->>'duration_seconds')::integer,(p_swim->>'distance_m')::numeric,
    (p_swim->>'pool_length_m')::numeric,(p_swim->>'length_count')::integer,p_swim->>'stroke')
   on conflict(session_id) do update set duration_seconds=excluded.duration_seconds,distance_m=excluded.distance_m,
    pool_length_m=excluded.pool_length_m,length_count=excluded.length_count,stroke=excluded.stroke;
 end if;
 select * into details from public.workout_swim_details where session_id=s.id and user_id=u;
 v_result:=jsonb_build_object('session',to_jsonb(s)-'user_id','swim',to_jsonb(details)-'user_id'-'session_id');
 update private.swim_requests set result=v_result where user_id=u and request_id=p_request_id;
 return v_result;
end $$;
revoke all on function private.swim_write(uuid,uuid,integer,text,date,jsonb,text,text) from public,anon;
grant execute on function private.swim_write(uuid,uuid,integer,text,date,jsonb,text,text) to authenticated;

create function public.save_swim_workout(p_request_id uuid,p_session_id uuid,p_expected_revision integer,p_date date,p_swim jsonb,p_notes text,p_timezone text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.swim_write(p_request_id,p_session_id,p_expected_revision,'save',p_date,p_swim,p_notes,p_timezone);
$$;
create function public.set_swim_workout_status(p_request_id uuid,p_session_id uuid,p_expected_revision integer,p_status text)
returns jsonb language plpgsql security invoker set search_path='' as $$ begin
 if p_status is null or p_status not in ('completed','cancelled') then raise exception 'invalid_status'; end if;
 return private.swim_write(p_request_id,p_session_id,p_expected_revision,p_status,null,null,null,null);
end $$;
revoke all on function public.save_swim_workout(uuid,uuid,integer,date,jsonb,text,text) from public,anon;
revoke all on function public.set_swim_workout_status(uuid,uuid,integer,text) from public,anon;
grant execute on function public.save_swim_workout(uuid,uuid,integer,date,jsonb,text,text) to authenticated;
grant execute on function public.set_swim_workout_status(uuid,uuid,integer,text) to authenticated;

-- Keep strength implementations intact; reject swim targets at every entry point.
alter function public.start_workout(uuid,uuid,date,boolean) rename to start_strength_workout;
revoke all on function public.start_strength_workout(uuid,uuid,date,boolean) from public,anon,authenticated;
create function public.start_workout(p_template_id uuid,p_session_id uuid,p_performed_on date,p_retroactive boolean default false)
returns public.workout_sessions language plpgsql security invoker set search_path='' as $$ begin
 if exists(select 1 from public.workout_templates where id=p_template_id and kind='swimming') then raise exception 'swimming_requires_dedicated_form'; end if;
 return public.start_strength_workout(p_template_id,p_session_id,p_performed_on,p_retroactive);
end $$;
-- The invoker wrapper needs access; the kind trigger protects this entry point too.
grant execute on function public.start_strength_workout(uuid,uuid,date,boolean) to authenticated;
alter function public.save_workout_template(uuid,text,integer,integer,jsonb,integer) rename to save_strength_workout_template;
create function public.save_workout_template(p_id uuid,p_name text,p_position integer,p_preferred_day integer,p_items jsonb,p_expected_revision integer default 0)
returns public.workout_templates language plpgsql security invoker set search_path='' as $$ begin
 if exists(select 1 from public.workout_templates where id=p_id and kind='swimming') then raise exception 'swimming_requires_dedicated_form'; end if;
 return public.save_strength_workout_template(p_id,p_name,p_position,p_preferred_day,p_items,p_expected_revision);
end $$;
revoke all on function public.start_workout(uuid,uuid,date,boolean) from public,anon;
revoke all on function public.save_workout_template(uuid,text,integer,integer,jsonb,integer) from public,anon;
grant execute on function public.start_workout(uuid,uuid,date,boolean) to authenticated;
grant execute on function public.save_workout_template(uuid,text,integer,integer,jsonb,integer) to authenticated;

create function private.workout_kind_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_table_name='workout_sessions' then
  if not exists(select 1 from public.workout_templates where id=new.template_id and user_id=new.user_id and kind=new.kind) then raise exception 'swimming_requires_dedicated_form'; end if;
 end if;
 if tg_op='UPDATE' and old.kind<>new.kind then raise exception 'workout_kind_immutable'; end if;
 return new;
end $$;
create trigger workout_session_kind before insert or update on public.workout_sessions for each row execute function private.workout_kind_guard();
create trigger workout_template_kind before update on public.workout_templates for each row execute function private.workout_kind_guard();
revoke all on function private.workout_kind_guard() from public,anon,authenticated;

alter function private.connector_write(uuid,text,jsonb) rename to connector_write_strength;
revoke all on function private.connector_write_strength(uuid,text,jsonb) from public,anon,authenticated;
create function private.connector_write(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if (p_action='workouts' and exists(select 1 from public.workout_templates where id=(p_payload->>'template_id')::uuid and user_id=auth.uid() and kind='swimming'))
  or (p_action='save_workout_template' and exists(select 1 from public.workout_templates where id=(p_payload->>'id')::uuid and user_id=auth.uid() and kind='swimming'))
  or (p_action in ('update_workout_session','set_workout_session_status') and exists(select 1 from public.workout_sessions where id=(p_payload->>'session_id')::uuid and user_id=auth.uid() and kind='swimming'))
  then raise exception 'swimming_write_not_supported'; end if;
 return private.connector_write_strength(p_request_id,p_action,p_payload);
end $$;
revoke all on function private.connector_write(uuid,text,jsonb) from public,anon;
grant execute on function private.connector_write(uuid,text,jsonb) to authenticated;
create or replace function public.connector_write(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.connector_write(p_request_id,p_action,p_payload); $$;

alter function private.connector_session(uuid) rename to connector_strength_session;
revoke all on function private.connector_strength_session(uuid) from public,anon,authenticated;
create function private.connector_session(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.connector_strength_session(p_id) || jsonb_build_object('swim',(
  select to_jsonb(d)-'user_id'-'session_id' from public.workout_swim_details d where d.session_id=p_id and d.user_id=auth.uid()));
$$;
revoke all on function private.connector_session(uuid) from public,anon,authenticated;

notify pgrst,'reload schema';
