# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is kept in sync with `AGENTS.md`; edit both together.

## What this is

ProCount — a personal, **single-user** PWA for daily protein + calorie tracking. Hebrew, RTL, dark mode, iPhone-first. All UI strings are Hebrew literals written inline; RTL is global (`index.html` has `dir="rtl"`), with `dir="ltr"` overrides only on technical fields (email, numeric inputs). React + Vite, **plain JS (no TypeScript)**, **inline styles only** — no UI framework, no CSS-in-JS; one global `src/index.css` holds resets/animations, font is `Heebo`.

## Commands

```sh
npm run dev        # Vite dev server → :5173
npm run build      # production build → dist/
npm run preview    # serve the built app → :4173
npm test           # pure-function tests: node --test src/lib/*.test.js
```

- Two test files (`nutrition.test.js`, `date.test.js`); one at a time: `node --test src/lib/nutrition.test.js`
- One test by name: `node --test --test-name-pattern="streak" src/lib/*.test.js`
- Edge-function tests run on **Deno**, a separate runtime: `deno test supabase/functions/analyze-food-photo/`
- Dev needs `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the anon key is public — RLS protects the data). Backend redeploy steps live in `supabase/README.md`.

## Architecture

**The frontend is a thin client over Supabase.** There is no app server: the PWA talks to Postgres directly through `supabase-js` and to one Edge Function for AI photo analysis. `Root.jsx` and `Login.jsx` are the only UI files besides the store that call the Supabase client, and only for session/authentication work; keep application-data queries and mutations in the store.

Render path: `main.jsx` → `Root.jsx` (auth gate — owns the Supabase session, renders `Login` or `App`) → `App.jsx` (the shell: header, bottom nav, FAB, sheets/overlays/dialogs, selected day, meal type, Trends range, and a `useMemo` view-model). Screens plus `FoodEditor.jsx`, `ItemDetailModal.jsx`, and `ConfirmDialog.jsx` are presentational: receive data and callbacks, and do not perform data access. `MealPlan.jsx` is intentionally static guidance, not profile- or entry-derived data. Destructive actions route through `ConfirmDialog` rather than firing directly.

**`src/store.js` (`useData` hook) is the single data layer.** On mount it loads the last `RANGE_DAYS` (35) of entries, all foods, and the profile in one `Promise.all`. Creation and food edits wait for Supabase's returned row before updating state; entry/food deletion and profile edits update local state before their write. Preserve the current error-handling semantics when changing mutations—there is no general rollback layer. `App.jsx` only consumes the hook's return value.

**Dates are local, never UTC (design §4).** The "today" boundary follows the device timezone. Each entry carries `eaten_on` — a `YYYY-MM-DD` the *client* assigns — so retroactive logging onto past days and day-navigation work without server involvement. All helpers in `src/lib/date.js` build dates from local Y/M/D; do **not** reach for `toISOString()`. The day-nav window is clamped to `RANGE_DAYS`.

**Nutrition math is pure and dependency-free** in `src/lib/nutrition.js` — it aggregates `entries` by `eaten_on` (`dailyTotals`, `remainingProtein`, `pct`, `dailyPace`, `streak`, `weekSeries`, `weeklyAverageSeries`, `entriesByMeal`, `proteinSuggestion`, …) and derives detail-modal values (`proteinPer100g`, `gramsPerServing`, which parses a gram amount from the free-text Hebrew `unit`). The meal suggestion may combine one or two catalog foods and permits at most 10g over the remaining protein target. It is the unit-tested core (`nutrition.test.js`, alongside `date.test.js`). Keep both libs import-free so they stay runnable under `node --test`.

## Data model & RLS (`supabase/migrations/`)

- **`foods` is a shared catalog, NOT per-user.** Migration `0002` dropped its `user_id`; any authenticated user reads/writes all foods (fine for a single-user app). Don't filter foods by user.
- **`entries` and `profile` are per-user**, scoped by an `own rows` policy (`user_id = auth.uid()`). `entries.source` ∈ `('manual','saved','ai')`; `food_id` is a soft link (nulled when a food is deleted). `entries.meal_type` is a non-null `breakfast`, `lunch`, `dinner`, or `snack` value (migration `0006`); older client rows with no value are treated as snacks by `entriesByMeal`.
- **`entries.grams` is nullable on purpose** (migration `0004`): it records how much was eaten so `ItemDetailModal` can show amount + protein-per-100g. Legacy and non-gram entries stay null and the UI renders `—`. Migration `0005` backfilled past quick-add rows by reconstructing servings from the protein ratio — read its header comment before trusting old `grams` values.
- **`profile`** holds `protein_goal_g`, `name` (used in the header greeting), and the AI-quota fields. There is **no signup trigger** — the row is created lazily by the client's first `upsert` (saving a goal or name). Any code that reads the profile must tolerate a missing row.
- The **AI daily cap is enforced server-side**: `consume_ai_call(limit)` (SECURITY INVOKER RPC, UTC day) atomically reserves one of 6 calls. Counting client-dated entries would be spoofable; this isn't.

## AI photo flow (`supabase/functions/analyze-food-photo/`)

`store.js` `analyzePhoto` compresses a camera or gallery image to ~1024px JPEG base64 → `POST /functions/v1/analyze-food-photo` with the user's JWT. The function keeps `ANTHROPIC_API_KEY` server-side, calls `consume_ai_call` (→ 429 `daily_limit` when spent), then makes one non-streaming Claude Messages call (`claude-sonnet-4-6`, structured `output_config` JSON schema). Success returns `{ name, calories, protein_g, confidence, note }`, shown in editable fields before saving an `ai` entry; saving that result to the shared catalog is explicit opt-in. Every failure (401/422/502) falls back to manual entry—see the response table in `supabase/README.md`. `validate.ts` enforces non-negativity (the schema cannot express it); `validate.test.ts` is its self-check.

## Conventions

- **Never create a branch named `codex/**`.** Use a descriptive feature, fix, or chore prefix instead.
- `// ponytail:` comments mark deliberate simplifications and name the upgrade path — read them before "fixing" something that looks too minimal.
- The PWA registration and Hebrew RTL manifest live in `vite.config.js`; keep the listed icon assets and `registerType: "autoUpdate"` behavior intact unless the release behavior is intentionally changing.
- Supabase MCP is connected; the ProCount project id is `ghttttnwebaozbadlonp` (the org also has an unrelated "World Cup 2026 ML Pipeline" project — don't confuse them). Schema changes go through `supabase/migrations/` (or `apply_migration` for the live DB), not ad-hoc SQL.
- Functional spec: `Docs/2026-06-18-procount-design.md` — the source of the `design §N` references in code comments. Visual design reference: `design_handoff_procount/`.
