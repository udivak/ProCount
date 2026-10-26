-- Self-contained fixtures; run with a privileged connection. Everything rolls back.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into auth.oauth_clients(id,client_name,registration_type,client_type,redirect_uris,grant_types,token_endpoint_auth_method) values
 ('33333333-3333-4333-8333-333333333333','management test','manual','public','["https://example.invalid/callback"]','["authorization_code","refresh_token"]','none'),
 ('44444444-4444-4444-8444-444444444444','other test','manual','public','["https://example.invalid/callback"]','["authorization_code","refresh_token"]','none');
insert into public.connector_permissions(user_id,client_id,workouts) values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.connector_read('capabilities','{}');
 if r->'permissions'->>'workout_catalog'<>'false' or r->'permissions'->>'workout_edit'<>'false' then raise exception 'new grants enabled implicitly'; end if;
 begin perform public.connector_write(gen_random_uuid(),'save_exercise','{}'); raise exception 'catalog allowed without grant'; exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
 begin insert into public.training_exercises(name,muscle_group) values('bad','bad'); raise exception 'direct write allowed'; exception when insufficient_privilege then null; end;
 begin perform private.connector_write_logging(gen_random_uuid(),'workouts','{}'); raise exception 'legacy writer exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.connector_permissions set workout_catalog=true,workout_edit=true where client_id='33333333-3333-4333-8333-333333333333';
insert into public.connector_permissions(user_id,client_id,workouts) values('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',true);
set local role authenticated;
do $$
declare
 e uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); s uuid; x uuid; st uuid; req uuid:=gen_random_uuid();
 p jsonb; r jsonb; snap jsonb; again jsonb; n integer; rev integer; exrev integer;
begin
 r:=public.connector_write(gen_random_uuid(),'save_exercise',jsonb_build_object('id',e,'expected_revision',0,'name','test pullup','muscle_group','back','load_mode','bodyweight','weight_basis','total','reps_basis','per_side'));
 if r->'exercise'->>'revision'<>'1' then raise exception 'exercise creation failed'; end if;
 begin perform public.connector_write(gen_random_uuid(),'save_exercise',(r->'exercise')||jsonb_build_object('expected_revision',0)); raise exception 'ownership fields accepted'; exception when raise_exception then if sqlerrm<>'invalid_fields' then raise; end if; end;
 r:=public.connector_write(gen_random_uuid(),'save_workout_template',jsonb_build_object('id',t,'expected_revision',0,'name','test A','position',0,'preferred_day',null,'items',jsonb_build_array(jsonb_build_object('exercise_id',e,'position',0,'rest_seconds',60,'target_sets','[{"reps_min":8,"reps_max":10}]'::jsonb))));
 if r->'template'->>'revision'<>'1' then raise exception 'template creation failed'; end if;
 begin perform public.connector_write(gen_random_uuid(),'save_workout_template',jsonb_build_object('id',t,'expected_revision',2,'name','stale','position',0,'preferred_day',null,'items',r->'items')); raise exception 'stale template accepted'; exception when raise_exception then if sqlerrm<>'template_conflict' then raise; end if; end;
 p:=jsonb_build_object('date','2026-10-20','template_id',t,'source_system','test-idan','source_workout_id','workout-1','exercises',jsonb_build_array(jsonb_build_object('exercise_id',e,'sets','[{"reps":8,"kind":"work"}]'::jsonb)));
 r:=public.connector_write(req,'workouts',p); s:=(r->'session'->>'id')::uuid;
 if r->'session'->>'status'<>'completed' or r->'session'->>'partial'<>'false' then raise exception 'complete workout failed'; end if;
 again:=public.connector_write(req,'workouts',p);
 if again<>r then raise exception 'retry differs'; end if;
 if public.connector_read('result',jsonb_build_object('request_id',req))->'result'<>r then raise exception 'timeout recovery failed'; end if;
 begin perform public.connector_write(req,'workouts',p||'{"notes":"changed"}'); raise exception 'changed request accepted'; exception when raise_exception then if sqlerrm<>'request_id_conflict' then raise; end if; end;
 again:=public.connector_write(gen_random_uuid(),'workouts',p);
 if again->'session'->>'id'<>s::text or again->>'already_imported'<>'true' then raise exception 'source dedup failed'; end if;
 begin perform public.connector_write(gen_random_uuid(),'workouts',p||'{"notes":"changed"}'); raise exception 'source overwrite accepted'; exception when raise_exception then if sqlerrm<>'source_payload_conflict' then raise; end if; end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"44444444-4444-4444-8444-444444444444"}',true);
 if public.connector_read('result',jsonb_build_object('request_id',req))->>'found'<>'false' then raise exception 'other client audit leaked'; end if;
 again:=public.connector_write(gen_random_uuid(),'workouts',p);
 if again->'session'->>'id'<>s::text then raise exception 'cross-client source dedup failed'; end if;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
 begin perform public.connector_write(gen_random_uuid(),'workouts',p-array['source_system','source_workout_id']); raise exception 'same-day duplicate allowed'; exception when raise_exception then if sqlerrm<>'possible_duplicate_workout' then raise; end if; end;
 snap:=public.connector_read('session',jsonb_build_object('session_id',s)); x:=(snap->'exercises'->0->>'id')::uuid; st:=(snap->'exercises'->0->'sets'->0->>'id')::uuid;
 if snap->'exercises'->0->>'reps_basis'<>'per_side' or snap->'exercises'->0->'sets'->0->'load_kg'<>'null'::jsonb then raise exception 'units changed'; end if;
 rev:=(snap->>'revision')::integer; exrev:=(snap->'exercises'->0->>'revision')::integer;
 -- A later invalid item must roll back earlier valid changes.
 begin
  perform public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',s,'expected_revision',rev,'notes','must roll back','sets',jsonb_build_array(
   jsonb_build_object('id',st,'expected_revision',1,'session_exercise_id',x,'expected_exercise_revision',exrev,'reps',9),
   jsonb_build_object('id',gen_random_uuid(),'expected_revision',1,'session_exercise_id',x,'expected_exercise_revision',exrev,'reps',10))));
  raise exception 'invalid patch accepted';
 exception when raise_exception then if sqlerrm<>'set_conflict' then raise; end if; end;
 if public.connector_read('session',jsonb_build_object('session_id',s))<>snap then raise exception 'partial correction persisted'; end if;
 r:=public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',s,'expected_revision',rev,'notes','corrected','sets',jsonb_build_array(jsonb_build_object('id',st,'expected_revision',1,'session_exercise_id',x,'expected_exercise_revision',exrev,'reps',9))));
 if r->'session'->'exercises'->0->'sets'->0->>'reps'<>'9' or r->'before'<>snap then raise exception 'patch/audit failed'; end if;
 begin perform public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',s,'expected_revision',rev,'notes','stale')); raise exception 'stale session accepted'; exception when raise_exception then if sqlerrm<>'session_conflict' then raise; end if; end;
 snap:=r->'session'; rev:=(snap->>'revision')::integer; exrev:=(snap->'exercises'->0->>'revision')::integer;
 -- Simulate a UI edit changing only the set revision.
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
 perform public.save_workout_set(st,x,0,'work',null,10,null,2);
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
 begin perform public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',s,'expected_revision',rev,'sets',jsonb_build_array(jsonb_build_object('id',st,'expected_revision',2,'session_exercise_id',x,'expected_exercise_revision',exrev,'reps',7)))); raise exception 'stale UI set overwritten'; exception when raise_exception then if sqlerrm<>'set_conflict' then raise; end if; end;
 r:=public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',s,'expected_revision',rev,'sets',jsonb_build_array(jsonb_build_object('id',st,'expected_revision',3,'session_exercise_id',x,'expected_exercise_revision',exrev,'remove',true))));
 if r->'session'->>'partial'<>'true' or jsonb_array_length(r->'session'->'exercises'->0->'sets')<>0 or r->'before'->'exercises'->0->'sets'->0->>'id'<>st::text then raise exception 'reversible removal failed'; end if;
 snap:=r->'session'; rev:=(snap->>'revision')::integer; exrev:=(snap->'exercises'->0->>'revision')::integer;
 r:=public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',s,'expected_revision',rev,'sets',jsonb_build_array(jsonb_build_object('id',st,'expected_revision',0,'session_exercise_id',x,'expected_exercise_revision',exrev,'position',0,'kind','work','reps',10))));
 if r->'session'->>'partial'<>'false' or r->'session'->>'notes'<>'corrected' then raise exception 'restore set or preserve notes failed'; end if;
 if r->'session'->'exercises'->0->'sets'->0->>'revision'<>'4' then raise exception 'restored version recycled'; end if;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
 begin perform public.save_workout_set(st,x,0,'work',null,7,null,1); raise exception 'stale pre-deletion UI overwrote restoration'; exception when raise_exception then if sqlerrm<>'set_conflict' then raise; end if; end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
 rev:=(r->'session'->>'revision')::integer;
 r:=public.connector_write(gen_random_uuid(),'set_workout_session_status',jsonb_build_object('session_id',s,'expected_revision',rev,'status','cancelled'));
 if r->'session'->>'status'<>'cancelled' then raise exception 'cancellation failed'; end if;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
 begin perform public.set_workout_exercise_status(x,'completed',1); raise exception 'cancelled exercise edited'; exception when raise_exception then if sqlerrm<>'workout_not_editable' then raise; end if; end;
 begin perform public.save_workout_set(gen_random_uuid(),x,1,'work',null,10,null,0); raise exception 'cancelled set added'; exception when raise_exception then if sqlerrm<>'invalid_set' then raise; end if; end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
 again:=public.connector_write(gen_random_uuid(),'workouts',p);
 if again->'session'->>'id'<>s::text or again->'session'->>'status'<>'cancelled' then raise exception 'cancelled import duplicated'; end if;
 r:=public.connector_write(gen_random_uuid(),'set_workout_session_status',jsonb_build_object('session_id',s,'expected_revision',(r->'session'->>'revision')::integer,'status','completed'));
 if r->'session'->>'status'<>'completed' then raise exception 'restore workout failed'; end if;
 -- A second same-day workout is valid only with explicit intent; editing the first is not a new workout.
 again:=public.connector_write(gen_random_uuid(),'workouts',(p-array['source_system','source_workout_id'])||'{"allow_same_day_session":true}');
 if again->'session'->>'id'=s::text then raise exception 'explicit second workout not created'; end if;
 snap:=public.connector_read('session',jsonb_build_object('session_id',s));
 r:=public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',s,'expected_revision',(snap->>'revision')::integer,'notes','same-day edit'));
 if r->'session'->>'notes'<>'same-day edit' then raise exception 'ordinary same-day edit failed'; end if;
 -- Legacy meal/water grants remain bounded and opt-in.
 begin perform public.connector_write(gen_random_uuid(),'water','{"date":"2026-10-20","water_ml":250}'); raise exception 'water grant bypass'; exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
 begin perform public.connector_write(gen_random_uuid(),'workouts',jsonb_set(p-array['source_system','source_workout_id'],'{date}','"2026-10-19"')||'{"exercises":[{"exercise_id":"11111111-1111-4111-8111-111111111111","sets":[{"reps":8,"load_kg":10}]}]}'); raise exception 'foreign exercise accepted'; exception when raise_exception then if sqlerrm<>'invalid_exercise' then raise; end if; end;
 for n in 1..2 loop
   perform public.connector_write(gen_random_uuid(),'save_exercise',jsonb_build_object('id',e,'expected_revision',n,'name','test pullup','muscle_group','back','load_mode',case n when 1 then 'external' else 'assisted' end,'weight_basis','per_hand','reps_basis','per_side'));
   begin perform public.connector_write(gen_random_uuid(),'workouts',jsonb_set(p-array['source_system','source_workout_id'],'{date}',to_jsonb(('2026-10-18'::date-n)::text))); raise exception 'required load missing'; exception when raise_exception then if sqlerrm<>'invalid_set' then raise; end if; end;
 end loop;
 -- Snapshot unaffected by future catalog edits.
 perform public.connector_write(gen_random_uuid(),'save_exercise',jsonb_build_object('id',e,'expected_revision',3,'name','new name','muscle_group','back','load_mode','assisted','weight_basis','total','reps_basis','total'));
 if public.connector_read('session',jsonb_build_object('session_id',s))->'exercises'->0->>'exercise_name'<>'test pullup' then raise exception 'history rewritten'; end if;
 perform set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
 begin perform public.connector_read('session',jsonb_build_object('session_id',s)); raise exception 'other user session leaked'; exception when raise_exception then if sqlerrm<>'session_not_found' then raise; end if; end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
 perform set_config('procount.test_request',req::text,true);
end $$;
reset role;
update public.connector_permissions set water=true,meals=true where client_id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
do $$ declare r jsonb; n integer; begin
 r:=public.connector_write(gen_random_uuid(),'water','{"date":"2026-10-20","water_ml":250}');
 if r->'entry'->>'water_ml'<>'250' then raise exception 'legacy water regressed'; end if;
 r:=public.connector_write(gen_random_uuid(),'meals','{"date":"2026-10-20","meal_type":"lunch","items":[{"name":"test","protein_g":10,"calories":100}]}');
 if jsonb_array_length(r->'entries')<>1 then raise exception 'legacy meal regressed'; end if;
 select count(*) into n from public.entries;
 begin perform public.connector_write(gen_random_uuid(),'meals','{"date":"2026-10-20","meal_type":"lunch","items":[{"name":"first","protein_g":10,"calories":100},{"name":"invalid","protein_g":-1,"calories":100}]}'); raise exception 'invalid meal accepted'; exception when raise_exception then if sqlerrm<>'invalid_food' then raise; end if; end;
 if (select count(*) from public.entries)<>n then raise exception 'legacy meal not atomic'; end if;
end $$;
reset role;
update public.connector_permissions set workouts=false where client_id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
do $$ begin
 begin perform public.connector_read('result',jsonb_build_object('request_id',current_setting('procount.test_request'))); raise exception 'revoked result exposed'; exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
end $$;
reset role;
-- Account removal still cascades cleanly; the set tombstone trigger must not recreate audit rows for a deleted owner.
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
rollback;
