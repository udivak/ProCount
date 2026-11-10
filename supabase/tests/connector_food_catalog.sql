-- Run on a local Supabase database. Fixtures and writes roll back.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111');
insert into auth.oauth_clients(id,client_name,registration_type,client_type,redirect_uris,grant_types,token_endpoint_auth_method) values
 ('33333333-3333-4333-8333-333333333333','food catalog test','manual','public','["https://example.invalid/callback"]','["authorization_code","refresh_token"]','none'),
 ('44444444-4444-4444-8444-444444444444','other client','manual','public','["https://example.invalid/callback"]','["authorization_code","refresh_token"]','none');
insert into public.connector_permissions(user_id,client_id,meals) values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"33333333-3333-4333-8333-333333333333"}',true);
set local role authenticated;
do $$ begin
 if public.connector_read('capabilities','{}')->'permissions'->'food_catalog' is distinct from 'false'::jsonb then
   raise exception 'food_catalog capability must default to false';
 end if;
 begin
   perform public.connector_write(gen_random_uuid(),'create_food','{}');
   raise exception 'catalog write allowed with only meals grant';
 exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
end $$;

reset role;
update public.connector_permissions set food_catalog=true,meals=false;
set local role authenticated;
do $$
declare
 req uuid:=gen_random_uuid();
 p jsonb:='{"name":"מולר בוטנים בדיקה","unit":"גביע 169 גרם","protein_g":22.139,"calories":224.77}';
 saved jsonb; reused jsonb; bad jsonb; original_claims text:=current_setting('request.jwt.claims');
begin
 if public.connector_read('capabilities','{}')->'permissions'->'food_catalog' is distinct from 'true'::jsonb then raise exception 'grant missing'; end if;
 begin
   insert into public.foods(name,protein_g,calories) values('direct write',0,0);
   raise exception 'OAuth direct insert allowed';
 exception when insufficient_privilege then null; end;
 begin
   update public.connector_permissions set meals=true;
   if found then raise exception 'OAuth changed own grants'; end if;
 end;
 foreach bad in array array['{"name":"\u200f"}'::jsonb,'{"unit":" "}','{"unit":null}','{"protein_g":-1}','{"calories":"225"}','{"calories":100001}','{"user_id":"untrusted"}'] loop
   begin
     perform public.connector_write(gen_random_uuid(),'create_food',p||bad);
     raise exception 'invalid payload accepted: %',bad;
   exception when raise_exception then if sqlerrm not in ('invalid_food','invalid_fields') then raise; end if; end;
 end loop;
 saved:=public.connector_write(req,'create_food',p);
 if saved->>'status' is distinct from 'created' or not exists (
   select from public.foods where id=(saved->'food'->>'id')::uuid and protein_g=22.139 and calories=224.77 and default_qty=1
 ) then raise exception 'food not saved with per-serving values'; end if;
 if exists(select from public.entries) then raise exception 'catalog write created a journal entry'; end if;
 if public.connector_write(req,'create_food',p) is distinct from saved then raise exception 'retry differs'; end if;
 if public.connector_read('result',jsonb_build_object('request_id',req))->'result' is distinct from saved then raise exception 'recovery differs'; end if;
 begin
   perform public.connector_write(req,'create_food',p||'{"calories":225}');
   raise exception 'changed request accepted';
 exception when raise_exception then if sqlerrm<>'request_id_conflict' then raise; end if; end;
 reused:=public.connector_write(gen_random_uuid(),'create_food',p||jsonb_build_object('name',U&'\200Fמולר  בוטנים בדיקה'));
 if reused->>'status' is distinct from 'reused' or reused->'food'->>'id' is distinct from saved->'food'->>'id' then raise exception 'normalized duplicate created'; end if;
 begin
   perform public.connector_write(gen_random_uuid(),'create_food',p||'{"calories":225}');
   raise exception 'conflicting values accepted';
 exception when raise_exception then if sqlerrm<>'food_values_conflict' then raise; end if; end;

 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","client_id":"44444444-4444-4444-8444-444444444444"}',true);
 if public.connector_read('result',jsonb_build_object('request_id',req))->>'found' is distinct from 'false' then raise exception 'request exposed to another client'; end if;
 begin
   perform public.connector_write(gen_random_uuid(),'create_food',p);
   raise exception 'other client inherited grant';
 exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
 begin
   perform public.connector_write(gen_random_uuid(),'create_food',p);
   raise exception 'non-OAuth request accepted';
 exception when raise_exception then if sqlerrm<>'invalid_request' then raise; end if; end;
 perform set_config('request.jwt.claims',original_claims,true);
 perform set_config('procount.test_food_request',req::text,true);
end $$;

reset role;
update public.connector_permissions set food_catalog=false,meals=true;
set local role authenticated;
do $$
declare
 req uuid:=current_setting('procount.test_food_request')::uuid;
 food_id uuid; meal jsonb;
begin
 begin
   perform public.connector_read('result',jsonb_build_object('request_id',req));
   raise exception 'revoked grant still recovers result';
 exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
 begin
   perform public.connector_write(req,'create_food','{"name":"מולר בוטנים בדיקה","unit":"גביע 169 גרם","protein_g":22.139,"calories":224.77}');
   raise exception 'revoked grant still writes or replays';
 exception when raise_exception then if sqlerrm<>'connector_write_not_authorized' then raise; end if; end;
 select id into strict food_id from public.foods where name='מולר בוטנים בדיקה';
 meal:=public.connector_write(gen_random_uuid(),'meals',jsonb_build_object(
   'date',(now() at time zone 'Asia/Jerusalem')::date,'meal_type','breakfast',
   'items',jsonb_build_array(jsonb_build_object('food_id',food_id,'quantity',1))));
 if meal->'entries'->0->>'food_id' is distinct from food_id::text
   or meal->'entries'->0->'protein_g' is distinct from '22.139'::jsonb
   or meal->'entries'->0->'calories' is distinct from '224.77'::jsonb then
   raise exception 'log_meal did not use the saved serving';
 end if;
end $$;
rollback;
