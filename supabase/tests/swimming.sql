-- Isolated/local database only; all fixtures roll back.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222') on conflict do nothing;
insert into auth.oauth_clients(id,registration_type,redirect_uris,grant_types,token_endpoint_auth_method)
 values('33333333-3333-4333-8333-333333333333','manual','["http://localhost"]','["authorization_code"]','none') on conflict do nothing;
insert into public.connector_permissions(user_id,client_id,workouts,workout_catalog,workout_edit)
 values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',true,true,true)
 on conflict(user_id,client_id) do update set workouts=true,workout_catalog=true,workout_edit=true;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
do $$
declare result jsonb; again jsonb; details jsonb:='{"duration_seconds":2100,"distance_m":1250,"pool_length_m":25,"length_count":50,"stroke":"freestyle"}';
 req uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); rev integer; n integer; swim_template uuid;
begin
 result:=public.save_swim_workout(req,sid,0,current_date,details,'test','Asia/Jerusalem');
 if result->'swim'->>'distance_m'<>'1250' or result->'session'->>'status'<>'completed' then raise exception 'swim readback failed'; end if;
 swim_template:=(result->'session'->>'template_id')::uuid;
 if exists(select 1 from public.workout_session_exercises where session_id=sid) then raise exception 'fake strength rows'; end if;
 again:=public.save_swim_workout(req,sid,0,current_date,details,'test','Asia/Jerusalem');
 if result<>again then raise exception 'retry differs'; end if;
 begin perform public.save_swim_workout(req,sid,0,current_date,details||'{"duration_seconds":2200}', 'test','Asia/Jerusalem'); raise exception 'changed retry accepted'; exception when raise_exception then if sqlerrm<>'request_id_conflict' then raise; end if; end;
 begin perform public.save_swim_workout(gen_random_uuid(),gen_random_uuid(),0,current_date,details,null,'Asia/Jerusalem'); raise exception 'duplicate accepted'; exception when raise_exception then if sqlerrm<>'possible_duplicate_workout' then raise; end if; end;
 begin perform public.save_swim_workout(gen_random_uuid(),gen_random_uuid(),0,current_date-1,details||'{"distance_m":1200}',null,'Asia/Jerusalem'); raise exception 'inconsistent distance accepted'; exception when raise_exception then if sqlerrm<>'invalid_swim' then raise; end if; end;
 if exists(select 1 from public.workout_sessions where performed_on=current_date-1 and kind='swimming') then raise exception 'partial invalid swim persisted'; end if;
 begin perform public.start_workout(swim_template,gen_random_uuid(),current_date-1,true); raise exception 'strength start allowed'; exception when raise_exception then if sqlerrm<>'swimming_requires_dedicated_form' then raise; end if; end;
 begin perform public.save_workout_template(swim_template,'bad',0,null,'[]',1); raise exception 'strength template edit allowed'; exception when raise_exception then if sqlerrm<>'swimming_requires_dedicated_form' then raise; end if; end;
 result:=public.save_swim_workout(gen_random_uuid(),sid,1,current_date,details||'{"duration_seconds":2200}',null,'Asia/Jerusalem');
 if (result->'session'->>'revision')::integer<>2 then raise exception 'revision not advanced'; end if;
 begin perform public.save_swim_workout(gen_random_uuid(),sid,1,current_date,details,null,'Asia/Jerusalem'); raise exception 'stale edit accepted'; exception when raise_exception then if sqlerrm<>'session_conflict' then raise; end if; end;
 begin update public.workout_sessions set notes='bypass' where id=sid; get diagnostics n=row_count; if n<>0 then raise exception 'direct swim mutation allowed'; end if; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
 if exists(select 1 from public.workout_swim_details where session_id=sid) then raise exception 'other user read swim'; end if;
 begin perform public.save_swim_workout(gen_random_uuid(),sid,2,current_date,details,null,'Asia/Jerusalem'); raise exception 'other user edit accepted'; exception when raise_exception then if sqlerrm<>'session_conflict' then raise; end if; end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","client_id":"33333333-3333-4333-8333-333333333333"}',true);
 begin perform public.save_swim_workout(gen_random_uuid(),sid,2,current_date,details,null,'Asia/Jerusalem'); raise exception 'OAuth write accepted'; exception when raise_exception then if sqlerrm<>'first_party_only' then raise; end if; end;
 result:=public.connector_read('session',jsonb_build_object('session_id',sid));
 if result->>'kind'<>'swimming' or result->'swim'->>'distance_m'<>'1250' then raise exception 'OAuth swim summary missing'; end if;
 begin perform public.connector_write(gen_random_uuid(),'update_workout_session',jsonb_build_object('session_id',sid,'expected_revision',2,'notes','bad')); raise exception 'OAuth strength edit accepted swim'; exception when raise_exception then if sqlerrm<>'swimming_write_not_supported' then raise; end if; end;
 begin perform public.connector_write(gen_random_uuid(),'set_workout_session_status',jsonb_build_object('session_id',sid,'expected_revision',2,'status','cancelled')); raise exception 'OAuth strength status accepted swim'; exception when raise_exception then if sqlerrm<>'swimming_write_not_supported' then raise; end if; end;
 begin perform public.connector_write(gen_random_uuid(),'workouts',jsonb_build_object('template_id',swim_template)); raise exception 'OAuth strength logging accepted swim'; exception when raise_exception then if sqlerrm<>'swimming_write_not_supported' then raise; end if; end;
 begin perform public.connector_write(gen_random_uuid(),'save_workout_template',jsonb_build_object('id',swim_template)); raise exception 'OAuth strength catalog accepted swim'; exception when raise_exception then if sqlerrm<>'swimming_write_not_supported' then raise; end if; end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
 result:=public.set_swim_workout_status(gen_random_uuid(),sid,2,'cancelled');
 if result->'session'->>'status'<>'cancelled' then raise exception 'cancel failed'; end if;
 if not exists(select 1 from public.workout_swim_details where session_id=sid) then raise exception 'cancel erased swim'; end if;
 result:=public.set_swim_workout_status(gen_random_uuid(),sid,3,'completed');
 if result->'session'->>'status'<>'completed' then raise exception 'restore failed'; end if;
 result:=public.save_swim_workout(gen_random_uuid(),gen_random_uuid(),0,current_date-1,'{"duration_seconds":900,"distance_m":null,"pool_length_m":null,"length_count":null,"stroke":null}',null,'Asia/Jerusalem');
 if result->'swim'->>'distance_m' is not null then raise exception 'unknown distance changed'; end if;
 raise notice 'PASS: swim create/readback, retry/conflict, duplicate, validation/rollback, strength guards, revisions, RLS, OAuth denial, cancel/restore, unknown distance';
end $$;
rollback;
