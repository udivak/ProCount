-- 0003: profile gets a display name, shown in the header greeting ("בוקר טוב, <name>").
-- Nullable — the client falls back to the email prefix when it's unset.

alter table profile add column if not exists name text;
