-- Run against the linked database. All fixtures and writes roll back.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.workout_templates limit 1),'role','authenticated')::text,true);
insert into public.connector_permissions(user_id,client_id,water,meals,workouts)
select auth.uid(),id,true,true,true from auth.oauth_clients where deleted_at is null limit 1
on conflict(user_id,client_id) do update set water=true,meals=true,workouts=true;
select set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb || jsonb_build_object('client_id',(select client_id from public.connector_permissions where user_id=auth.uid() and water and meals and workouts limit 1)))::text,true);
select set_config('procount.test_claims',current_setting('request.jwt.claims'),true);
set local role authenticated;
do $$
declare r jsonb; again jsonb; req uuid:=gen_random_uuid(); payload jsonb; t uuid; e uuid; cnt integer;
begin
 payload:=jsonb_build_object('date',(now() at time zone 'Asia/Jerusalem')::date,'water_ml',500);
 r:=public.connector_write(req,'water',payload);
 again:=public.connector_write(req,'water',payload);
 if r<>again or not (r->>'saved')::boolean then raise exception 'retry failed'; end if;
 if not exists(select 1 from public.entries where id=(r->'entry'->>'id')::uuid and water_ml=500) then raise exception 'water readback failed'; end if;
 begin perform public.connector_write(req,'water',payload||'{"water_ml":600}'); raise exception 'conflict accepted'; exception when raise_exception then if sqlerrm<>'request_id_conflict' then raise; end if; end;
 begin insert into public.entries(eaten_on,name,protein_g,calories,source) values(current_date,'should fail',0,0,'manual'); raise exception 'direct insert allowed'; exception when insufficient_privilege then null; end;
 begin update public.connector_permissions set water=false where user_id=auth.uid(); get diagnostics cnt=row_count; if cnt<>0 then raise exception 'self grant mutation allowed'; end if; end;
 r:=public.connector_write(gen_random_uuid(),'meals',jsonb_build_object('date',payload->>'date','meal_type','lunch','items','[{"name":"בדיקה","protein_g":25,"calories":200},{"name":"בדיקה 2","protein_g":5,"calories":100}]'::jsonb));
 if jsonb_array_length(r->'entries')<>2 then raise exception 'meal failed'; end if;
 select count(*) into cnt from public.entries;
 begin perform public.connector_write(gen_random_uuid(),'meals',jsonb_build_object('date',payload->>'date','meal_type','lunch','items','[{"name":"first","protein_g":1,"calories":1},{"name":"invalid","protein_g":-1,"calories":1}]'::jsonb)); raise exception 'invalid meal accepted'; exception when raise_exception then if sqlerrm<>'invalid_food' then raise; end if; end;
 if (select count(*) from public.entries)<>cnt then raise exception 'partial meal persisted'; end if;
 select template_id,exercise_id into t,e from public.workout_template_exercises limit 1;
 r:=public.connector_write(gen_random_uuid(),'workouts',jsonb_build_object('date',payload->>'date','template_id',t,'exercises',jsonb_build_array(jsonb_build_object('exercise_id',e,'sets','[{"reps":10,"load_kg":20}]'::jsonb))));
 if r->'session'->>'status'<>'completed' then raise exception 'workout failed'; end if;
 if not exists(select 1 from public.workout_sets ws join public.workout_session_exercises se on se.id=ws.session_exercise_id where se.session_id=(r->'session'->>'id')::uuid and ws.reps=10 and ws.load_kg=20) then raise exception 'set readback failed'; end if;
 select count(*) into cnt from public.workout_sessions;
 begin
   perform public.connector_write(gen_random_uuid(),'workouts',jsonb_build_object('date',payload->>'date','template_id',t,'exercises',jsonb_build_array(jsonb_build_object('exercise_id',e,'sets','[{"reps":10,"load_kg":20}]'::jsonb),jsonb_build_object('exercise_id',gen_random_uuid(),'sets','[{"reps":10,"load_kg":20}]'::jsonb))));
   raise exception 'invalid workout accepted';
 exception when raise_exception then if sqlerrm<>'invalid_exercise' then raise; end if; end;
 if (select count(*) from public.workout_sessions)<>cnt then raise exception 'partial workout persisted'; end if;
 begin perform public.connector_clients(); raise exception 'OAuth accessed permission management'; exception when raise_exception then if sqlerrm<>'first_party_only' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','client_id',auth.jwt()->>'client_id')::text,true);
 begin perform public.connector_write(gen_random_uuid(),'water',payload); raise exception 'other user write allowed'; exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
 raise notice 'PASS: water readback, retry, payload conflict, direct-write denial, self-grant denial, meal readback, atomic rollback, workout/set readback';
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('procount.test_claims'),true);
update public.connector_permissions set water=false where user_id=auth.uid() and client_id=(auth.jwt()->>'client_id')::uuid;
set local role authenticated;
do $$ begin
 begin perform public.connector_write(gen_random_uuid(),'water',jsonb_build_object('date',current_date,'water_ml',100)); raise exception 'revoked write allowed'; exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
 raise notice 'PASS: revoked grant denied with same token';
end $$;
select 'PASS: all connector database assertions completed; test transaction rolled back' as result;
rollback;
