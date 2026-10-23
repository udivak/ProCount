-- Managed Supabase does not let postgres delegate USAGE on auth to custom roles.
-- Keep the definer private, with explicit JWT/grant/ownership checks at every write.
grant procount_connector_writer to postgres;
alter function private.connector_write(uuid,text,jsonb) owner to postgres;
drop owned by procount_connector_writer;
revoke procount_connector_writer from postgres;
drop role procount_connector_writer;
