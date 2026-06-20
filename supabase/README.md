# ProCount — Backend (Supabase)

Postgres schema + RLS and one edge function. No server to run; the PWA talks to
Supabase directly (data) and to the edge function (photo → AI estimate).

## Layout

```
supabase/
  config.toml                         project ref + function JWT setting
  migrations/0001_init.sql            foods, entries, profile + RLS
  functions/analyze-food-photo/
    index.ts                          authed proxy to Claude vision, soft daily cap
    validate.ts                       parse/validate the AI estimate
    validate.test.ts                  self-check (design §9)
```

## Deploy

```sh
# one-time
supabase link --project-ref <your-project-ref>

# schema + RLS
supabase db push

# Claude key, server-side only — never ships to the client
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# edge function
supabase functions deploy analyze-food-photo
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into the function automatically.

## Test

```sh
deno test supabase/functions/analyze-food-photo/
```

## Auth

Supabase Auth, email + password. Enable the Email provider and turn **Confirm
email** OFF (the free tier has no SMTP); no extra backend code needed.

## Client → function contract

`POST /functions/v1/analyze-food-photo` with the user's `Authorization: Bearer <jwt>`:

```json
{ "image": "<base64, no data: prefix>", "mediaType": "image/jpeg" }
```

Compress to ~1024px JPEG before sending (fewer tokens, smaller upload). The 6/day
cap is enforced server-side (UTC day, `consume_ai_call`) — not client-spoofable.

Responses:

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ name, calories, protein_g, confidence, note }` | estimate — show in **editable** fields, then save as an `entry` with `source='ai'` |
| 429 | `{ error: "daily_limit", limit: 6 }` | over the soft cap — fall back to manual entry |
| 401 | `{ error: "unauthorized" }` | no / invalid session |
| 422 | `{ error: "ai_refused" }` | model declined — fall back to manual |
| 502 | `{ error: "ai_unavailable" \| "ai_unparseable" }` | upstream/parse failure — fall back to manual |

## Out of scope here

Client-side trend math (`dailyTotals`, `remainingProtein`, `streak`) lives with the
frontend, not the backend — it reads `entries` + the goal and aggregates by `eaten_on`.
