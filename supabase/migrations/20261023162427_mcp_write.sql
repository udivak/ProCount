-- OAuth tokens remain unable to mutate tables directly. Only these bounded RPCs write.
create schema if not exists private;
create table public.connector_permissions (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 client_id uuid not null references auth.oauth_clients(id) on delete cascade,
 water boolean not null default false, meals boolean not null default false, workouts boolean not null default false,
 primary key(user_id,client_id)
);
alter table public.connector_permissions enable row level security;
create policy "owner manages connector permissions" on public.connector_permissions for all to authenticated
 using (user_id=auth.uid() and (auth.jwt()->>'client_id') is null)
 with check (user_id=auth.uid() and (auth.jwt()->>'client_id') is null);
create table private.connector_requests (
 user_id uuid not null references auth.users(id) on delete cascade, client_id uuid not null,
 request_id uuid not null, action text not null, payload jsonb not null, result jsonb,
 created_at timestamptz not null default now(), primary key(user_id,client_id,request_id)
);
alter table private.connector_requests enable row level security;

create function private.connector_write(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid(); c uuid := (auth.jwt()->>'client_id')::uuid;
 old private.connector_requests; result jsonb; d date; item jsonb; st jsonb;
 row public.entries; food public.foods; sess public.workout_sessions; ex public.workout_session_exercises;
 ids jsonb := '[]'; n numeric; pos integer; session_id uuid := gen_random_uuid();
begin
 if u is null or c is null or p_request_id is null or p_action not in ('water','meals','workouts')
   or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
   raise exception 'invalid_request';
 end if;
 -- Read the current grant on every call, including retries.
 perform 1 from public.connector_permissions g join auth.oauth_clients oc on oc.id=g.client_id
 where g.user_id=u and g.client_id=c and oc.deleted_at is null and
 case p_action when 'water' then g.water when 'meals' then g.meals when 'workouts' then g.workouts end;
 if not found then raise exception 'connector_write_not_authorized'; end if;
 insert into private.connector_requests(user_id,client_id,request_id,action,payload)
 values(u,c,p_request_id,p_action,p_payload) on conflict do nothing;
 select * into old from private.connector_requests where user_id=u and client_id=c and request_id=p_request_id for update;
 if old.action<>p_action or old.payload<>p_payload then raise exception 'request_id_conflict'; end if;
 if old.result is not null then return old.result; end if;
 if coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
 d := (p_payload->>'date')::date;
 if d > (now() at time zone 'Asia/Jerusalem')::date then raise exception 'future_date'; end if;
 if p_action='water' then
   n := (p_payload->>'water_ml')::numeric;
   if n is null or n<=0 or n>10000 or n<>trunc(n) then raise exception 'invalid_water'; end if;
   insert into public.entries(user_id,eaten_on,name,protein_g,calories,source,entry_kind,water_ml,meal_type)
   values(u,d,'מים',0,0,'manual','water',n,'snack') returning * into row;
   result := jsonb_build_object('entry',to_jsonb(row));
 elsif p_action='meals' then
   if p_payload->>'meal_type' is null or p_payload->>'meal_type' not in ('breakfast','lunch','dinner','snack')
     or jsonb_typeof(p_payload->'items') is distinct from 'array' then raise exception 'invalid_meal'; end if;
   if jsonb_array_length(p_payload->'items') not between 1 and 50 then raise exception 'invalid_meal'; end if;
   for item in select value from jsonb_array_elements(p_payload->'items') loop
     if item->>'food_id' is not null then
       select * into food from public.foods where id=(item->>'food_id')::uuid;
       if not found then raise exception 'food_not_found'; end if;
       n := (item->>'quantity')::numeric;
       if n is null or n<=0 or n>100 then raise exception 'invalid_quantity'; end if;
       insert into public.entries(user_id,eaten_on,name,protein_g,calories,source,food_id,grams,meal_type)
       values(u,d,food.name,food.protein_g*n,food.calories*n,'saved',food.id,
         (substring(food.unit from '(\d+(?:\.\d+)?)\s*(?:גרם|גר|g)'))::numeric*n,p_payload->>'meal_type') returning * into row;
     else
       if length(btrim(coalesce(item->>'name',''))) not between 1 and 200
         or jsonb_typeof(item->'protein_g') is distinct from 'number'
         or jsonb_typeof(item->'calories') is distinct from 'number'
         or (item->>'protein_g')::numeric not between 0 and 10000
         or (item->>'calories')::numeric not between 0 and 100000
         or coalesce(item->>'source','manual') not in ('manual','ai') then raise exception 'invalid_food'; end if;
       insert into public.entries(user_id,eaten_on,name,protein_g,calories,source,grams,meal_type)
       values(u,d,btrim(item->>'name'),(item->>'protein_g')::numeric,(item->>'calories')::numeric,
         coalesce(item->>'source','manual'),(item->>'grams')::numeric,p_payload->>'meal_type') returning * into row;
     end if;
     if row.grams is not null and (row.grams<=0 or row.grams>100000) then raise exception 'invalid_grams'; end if;
     ids := ids || jsonb_build_array(to_jsonb(row));
   end loop;
   result := jsonb_build_object('entries',ids);
 else
   if jsonb_typeof(p_payload->'exercises') is distinct from 'array' then raise exception 'invalid_workout'; end if;
   if jsonb_array_length(p_payload->'exercises') not between 1 and 50 then raise exception 'invalid_workout'; end if;
   -- Existing snapshot creation validates template ownership and preserves exercise units.
   sess := public.start_workout((p_payload->>'template_id')::uuid,session_id,d,true);
   update public.workout_session_exercises set status='skipped' where user_id=u and workout_session_exercises.session_id=sess.id;
   for item in select value from jsonb_array_elements(p_payload->'exercises') loop
     select * into ex from public.workout_session_exercises where user_id=u and workout_session_exercises.session_id=sess.id
       and exercise_id=(item->>'exercise_id')::uuid and status='skipped' order by position limit 1;
     if not found or jsonb_typeof(item->'sets') is distinct from 'array' then raise exception 'invalid_exercise'; end if;
     if jsonb_array_length(item->'sets') not between 1 and 50 then raise exception 'invalid_sets'; end if;
     pos:=0;
     for st in select value from jsonb_array_elements(item->'sets') loop
       if jsonb_typeof(st->'reps') is distinct from 'number' or (st->>'reps')::numeric<>trunc((st->>'reps')::numeric)
         or (st->>'reps')::numeric not between 1 and 10000 or length(coalesce(st->>'note',''))>1000
         or ((st->>'load_kg') is not null and (st->>'load_kg')::numeric not between 0 and 10000) then raise exception 'invalid_set'; end if;
       perform public.save_workout_set(gen_random_uuid(),ex.id,pos,coalesce(st->>'kind','work'),
         (st->>'load_kg')::numeric,(st->>'reps')::integer,st->>'note',0);
       pos:=pos+1;
     end loop;
     update public.workout_session_exercises set status='completed',revision=revision+1 where id=ex.id and user_id=u;
   end loop;
   update public.workout_sessions set status='completed',notes=left(p_payload->>'notes',1000),
     partial=exists(select 1 from public.workout_session_exercises where workout_session_exercises.session_id=sess.id and status='skipped'),
     revision=revision+1 where id=sess.id and user_id=u returning * into sess;
   result:=jsonb_build_object('session',to_jsonb(sess));
 end if;
 result:= result || jsonb_build_object('request_id',p_request_id,'saved',true);
 update private.connector_requests set result=connector_write.result where user_id=u and client_id=c and request_id=p_request_id;
 return result;
end $$;
revoke all on function private.connector_write(uuid,text,jsonb) from public;
grant usage on schema private to authenticated;
grant execute on function private.connector_write(uuid,text,jsonb) to authenticated;
create function public.connector_write(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.connector_write(p_request_id,p_action,p_payload); $$;
revoke all on function public.connector_write(uuid,text,jsonb) from public;
grant execute on function public.connector_write(uuid,text,jsonb) to authenticated;
-- Dedicated owner has no login, membership, catalog mutation, or delete privileges.
create role procount_connector_writer nologin noinherit;
grant usage on schema public,private,auth to procount_connector_writer;
grant select on auth.oauth_clients to procount_connector_writer;
grant select on public.connector_permissions,public.foods,public.workout_templates,public.workout_template_exercises,public.training_exercises to procount_connector_writer;
grant select,insert on public.entries to procount_connector_writer;
grant select,insert,update on public.workout_sessions,public.workout_session_exercises,public.workout_sets,private.connector_requests to procount_connector_writer;
grant execute on function public.start_workout(uuid,uuid,date,boolean),public.save_workout_set(uuid,uuid,integer,text,numeric,integer,text,integer) to procount_connector_writer;
create policy "writer grants" on public.connector_permissions for select to procount_connector_writer using(user_id=auth.uid());
create policy "writer audit" on private.connector_requests for all to procount_connector_writer using(user_id=auth.uid()) with check(user_id=auth.uid());
do $$ declare t text; begin
 foreach t in array array['entries','workout_sessions','workout_session_exercises','workout_sets','workout_templates','workout_template_exercises','training_exercises'] loop
 execute format('create policy "connector writer own rows" on public.%I for all to procount_connector_writer using(user_id=auth.uid()) with check(user_id=auth.uid())',t);
 end loop;
end $$;
create policy "writer foods read" on public.foods for select to procount_connector_writer using(true);
grant create on schema private to procount_connector_writer;
grant procount_connector_writer to postgres;
alter function private.connector_write(uuid,text,jsonb) owner to procount_connector_writer;
revoke procount_connector_writer from postgres;
revoke create on schema private from procount_connector_writer;

grant update(id) on public.workout_templates to procount_connector_writer;
