-- Opt-in creation in the shared catalog; no direct OAuth table writes.
alter table public.connector_permissions add column food_catalog boolean not null default false;

create or replace function private.connector_allowed(p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.connector_permissions g join auth.oauth_clients c on c.id=g.client_id
 where g.user_id=auth.uid() and g.client_id=(auth.jwt()->>'client_id')::uuid and c.deleted_at is null
 and case p_action when 'water' then g.water when 'meals' then g.meals when 'workouts' then g.workouts
 when 'create_food' then g.food_catalog
 when 'save_exercise' then g.workout_catalog when 'save_workout_template' then g.workout_catalog
 when 'update_workout_session' then g.workout_edit when 'set_workout_session_status' then g.workout_edit else false end);
$$;
revoke all on function private.connector_allowed(text) from public,anon,authenticated;

-- Match the catalog's name/unit comparison, including Hebrew bidi formatting.
create function private.connector_food_key(p_text text) returns text
language sql immutable strict set search_path='' as $$
 select lower(btrim(regexp_replace(
   translate(normalize(p_text, NFKC), U&'\200B\200C\200D\200E\200F\2060\FEFF', ''),
   U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000]+', ' ', 'g')));
$$;
revoke all on function private.connector_food_key(text) from public,anon,authenticated;

create function private.connector_create_food(p_request_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); c uuid:=(auth.jwt()->>'client_id')::uuid;
 prior private.connector_requests; food public.foods;
 food_name text; food_unit text; name_key text; unit_key text;
 protein numeric; kcal numeric; outcome text; response jsonb;
begin
 if u is null or c is null or p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object'
   or octet_length(p_payload::text)>65536 then raise exception 'invalid_request'; end if;
 if not private.connector_allowed('create_food') then raise exception 'connector_write_not_authorized'; end if;

 insert into private.connector_requests(user_id,client_id,request_id,action,payload)
 values(u,c,p_request_id,'create_food',p_payload) on conflict do nothing;
 select * into prior from private.connector_requests
 where user_id=u and client_id=c and request_id=p_request_id for update;
 if prior.action<>'create_food' or prior.payload<>p_payload then raise exception 'request_id_conflict'; end if;
 if prior.result is not null then return prior.result; end if;

 perform private.connector_keys(p_payload,array['name','unit','protein_g','calories']);
 if jsonb_typeof(p_payload->'name') is distinct from 'string'
   or jsonb_typeof(p_payload->'unit') is distinct from 'string'
   or jsonb_typeof(p_payload->'protein_g') is distinct from 'number'
   or jsonb_typeof(p_payload->'calories') is distinct from 'number' then raise exception 'invalid_food'; end if;
 food_name:=btrim(p_payload->>'name');
 food_unit:=btrim(p_payload->>'unit');
 name_key:=private.connector_food_key(food_name);
 unit_key:=private.connector_food_key(food_unit);
 protein:=(p_payload->>'protein_g')::numeric;
 kcal:=(p_payload->>'calories')::numeric;
 if name_key='' or unit_key='' or length(food_name)>200 or length(food_unit)>100
   or protein not between 0 and 10000 or kcal not between 0 and 100000 then raise exception 'invalid_food'; end if;

 -- shortcut: serializes MCP creates only, share this write path if the PWA must also deduplicate concurrent saves.
 perform pg_advisory_xact_lock(hashtextextended('connector-food:'||jsonb_build_array(name_key,unit_key)::text,0));
 select f.* into food from public.foods f
 where private.connector_food_key(f.name)=name_key and private.connector_food_key(f.unit)=unit_key
 order by (f.protein_g=protein and f.calories=kcal) desc, f.created_at, f.id limit 1;
 if found then
   if food.protein_g<>protein or food.calories<>kcal then raise exception 'food_values_conflict'; end if;
   outcome:='reused';
 else
   insert into public.foods(name,unit,protein_g,calories) values(food_name,food_unit,protein,kcal) returning * into food;
   outcome:='created';
 end if;
 response:=jsonb_build_object('status',outcome,'food',to_jsonb(food),'request_id',p_request_id);
 update private.connector_requests set result=response
 where user_id=u and client_id=c and request_id=p_request_id;
 return response;
end $$;
alter function private.connector_create_food(uuid,jsonb) owner to postgres;
revoke all on function private.connector_create_food(uuid,jsonb) from public,anon,authenticated;

create or replace function private.connector_write(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if p_action='create_food' then return private.connector_create_food(p_request_id,p_payload); end if;
 if (p_action='workouts' and exists(select 1 from public.workout_templates where id=(p_payload->>'template_id')::uuid and user_id=auth.uid() and kind='swimming'))
  or (p_action='save_workout_template' and exists(select 1 from public.workout_templates where id=(p_payload->>'id')::uuid and user_id=auth.uid() and kind='swimming'))
  or (p_action in ('update_workout_session','set_workout_session_status') and exists(select 1 from public.workout_sessions where id=(p_payload->>'session_id')::uuid and user_id=auth.uid() and kind='swimming'))
  then raise exception 'swimming_write_not_supported'; end if;
 return private.connector_write_strength(p_request_id,p_action,p_payload);
end $$;

create or replace function private.connector_read(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c uuid:=(auth.jwt()->>'client_id')::uuid; r jsonb; req private.connector_requests;
begin
 if u is null or c is null or not exists(select 1 from auth.oauth_clients where id=c and deleted_at is null)
  or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1024 then raise exception 'invalid_request'; end if;
 if p_action='capabilities' then
   perform private.connector_keys(p_payload,'{}');
   return jsonb_build_object('version','1.3.0','permissions',jsonb_build_object(
    'water',private.connector_allowed('water'),'meals',private.connector_allowed('meals'),'workouts',private.connector_allowed('workouts'),
    'food_catalog',private.connector_allowed('create_food'),
    'workout_catalog',private.connector_allowed('save_exercise'),'workout_edit',private.connector_allowed('update_workout_session')),
    'actions',jsonb_build_array('create_food','log_water','log_meal','log_workout','save_exercise','save_workout_template','update_workout_session','set_workout_session_status','get_workout_session','get_write_result','get_connector_capabilities'),
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
create or replace function private.connector_clients() returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or auth.jwt()->>'client_id' is not null then raise exception 'first_party_only'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('client_id',c.id,'client_name',c.client_name,
 'water',coalesce(g.water,false),'meals',coalesce(g.meals,false),'workouts',coalesce(g.workouts,false),
 'food_catalog',coalesce(g.food_catalog,false),
 'workout_catalog',coalesce(g.workout_catalog,false),'workout_edit',coalesce(g.workout_edit,false)))
 from auth.oauth_consents a join auth.oauth_clients c on c.id=a.client_id left join public.connector_permissions g on g.user_id=a.user_id and g.client_id=c.id
 where a.user_id=auth.uid() and a.revoked_at is null and c.deleted_at is null),'[]'::jsonb);
end $$;

notify pgrst,'reload schema';
