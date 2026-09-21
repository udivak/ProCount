# ProCount

מעקב יומי אחר **חלבון** ו**קלוריות** — אפליקציית PWA אישית (משתמש יחיד), בעברית, RTL, מצב כהה, בנויה לאייפון.

Personal, single-user PWA for daily **protein** and **calorie** tracking. Hebrew, RTL, dark mode, mobile-first. Protein has a daily goal; calories are a running count. Log food three ways: a grid of saved foods, manual entry with optional AI completion, or a photo analyzed by OpenAI.

## Stack

- **Frontend:** React + Vite, packaged as a PWA (`vite-plugin-pwa`). Inline-styled, no UI framework.
- **Backend:** Supabase — Postgres with RLS, Auth (email + password), and one Edge Function (`analyze-food-photo`) that proxies OpenAI and holds the API key server-side.
- **AI:** `gpt-6-astra` via the OpenAI Responses API, low reasoning, `store: false`, and strict structured output.

## Structure

```
src/
  App.jsx            shell: header, bottom nav, FAB, view-model, sheet/overlay wiring
  Root.jsx           auth gate
  Login.jsx          email + password sign-in
  FoodEditor.jsx     add / edit / delete a saved food
  store.js           useData hook — load + mutations + photo → edge function
  lib/
    supabase.js      client
    nutrition.js     pure calc (dailyTotals, remainingProtein, pct, streak, …) + nutrition.test.js
    date.js          local-date helpers
    icons.jsx        inline SVG icons
  screens/           Today · Trends · MyFoods · AddSheet · Settings
supabase/
  migrations/        schema + RLS + AI cost-brake (consume_ai_call)
  functions/analyze-food-photo/   edge function + parser + self-check
  README.md          backend deploy notes + client↔function contract
Docs/                              functional spec
design_handoff_procount/          visual design reference
```

## Local development

```sh
npm install
# create .env.local with your Supabase values (Settings → API):
#   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
#   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
npm run dev
```

The anon/publishable key is safe to expose to the client — RLS protects the data.

### Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | production build → `dist/` |
| `npm run preview` | serve the built app |
| `npm test` | nutrition pure-function tests (`node --test`) |

## Backend

The Supabase project is already provisioned: schema, RLS, the `consume_ai_call` cost-brake, and the deployed `analyze-food-photo` function. To redeploy from scratch (migration + function + secret) see [`supabase/README.md`](supabase/README.md).

The Edge function requires an `OPENAI_API_KEY` secret. The daily cost-brake caps all AI estimates (photo and manual completion) at **6 per user per day**, enforced server-side. Manual AI completion estimates one selected unit, applies quantity locally for the preview, and remains editable until the user explicitly saves.

## Before shipping to prod

1. Set the `OPENAI_API_KEY` secret on the Edge function (else photo analysis and manual completion retain their editable manual fallback).
2. Auth → Sign In / Providers → Email: turn **Confirm email** OFF — the free tier has no SMTP, so signup must not require email verification.
3. Disable open sign-ups after creating your account (this is a single-user app).
4. Host the static build and set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in the host's env.

## Tests

Pure nutrition logic is unit-tested (`src/lib/nutrition.test.js`). The Edge function's AI-response parsing has a self-check (`supabase/functions/analyze-food-photo/validate.test.ts`, run with `deno test`).
