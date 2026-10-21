-- Tokens issued by the Supabase OAuth 2.1 server (the read-only MCP connector in
-- Claude/ChatGPT) carry a client_id claim. These restrictive policies AND with the
-- existing "own rows"/"shared foods" policies, so such tokens can read but never
-- write, even when sent straight to PostgREST instead of through the MCP function.
-- First-party PWA sessions carry no client_id and are unaffected. The write RPCs
-- are SECURITY INVOKER, so they hit these policies too.
do $$
declare t text;
begin
  foreach t in array array['entries', 'foods', 'profile', 'training_exercises', 'workout_templates',
    'workout_template_exercises', 'workout_sessions', 'workout_session_exercises', 'workout_sets']
  loop
    execute format('create policy "oauth clients cannot insert" on public.%I as restrictive for insert to authenticated with check ((select auth.jwt() ->> ''client_id'') is null)', t);
    execute format('create policy "oauth clients cannot update" on public.%I as restrictive for update to authenticated using ((select auth.jwt() ->> ''client_id'') is null)', t);
    execute format('create policy "oauth clients cannot delete" on public.%I as restrictive for delete to authenticated using ((select auth.jwt() ->> ''client_id'') is null)', t);
  end loop;
end $$;
