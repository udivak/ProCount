# AGENTS.md

This file provides guidance to coding agents (Codex, Cursor, and other AGENTS.md-aware tools) when working with code in this repository. It is kept in sync with `CLAUDE.md` — the two files are identical apart from this header, so edit both together.

## What this is

ProCount — a personal, **single-user** PWA for daily protein, calorie, and water tracking. Hebrew, RTL, dark mode, iPhone-first. All UI strings are Hebrew literals written inline; RTL is global (`index.html` has `dir="rtl"`), with `dir="ltr"` overrides only on technical fields (email, numeric inputs). React + Vite, **plain JS (no TypeScript)**, **inline styles only** — no UI framework, no CSS-in-JS; one global `src/index.css` holds resets/animations, font is `Heebo`.

## Commands

```sh
npm run dev        # Vite dev server → :5173
npm run build      # production build → dist/
npm run preview    # serve the built app → :4173
npm test           # pure-function tests: node --test src/lib/*.test.js
```

- Eight colocated test files currently cover the pure helpers in `src/lib/`; one at a time: `node --test src/lib/meal.test.js`
- One test by name: `node --test --test-name-pattern="streak" src/lib/*.test.js`
- Edge-function validation and guidance tests run on **Deno**, a separate runtime: `deno test supabase/functions/analyze-food-photo/`
- Dev needs `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the anon key is public — RLS protects the data). Backend redeploy steps live in `supabase/README.md`.

## Architecture

**The frontend is a thin client over Supabase.** There is no app server: the PWA talks to Postgres directly through `supabase-js` and to one Edge Function for AI photo and manual nutrition estimates. `Root.jsx` and `Login.jsx` are the only UI files besides the store that call the Supabase client, and only for session/authentication work; keep application-data queries and mutations in the store.

Render path: `main.jsx` → `Root.jsx` (auth gate and standalone-viewport recovery; renders `Login` or `App`) → `App.jsx` (the shell: header, bottom nav, FAB, sheets/overlays/dialogs, selected day, meal type, Trends range, undo state, and a `useMemo` view-model). Screens plus `FoodEditor.jsx`, `ItemDetailModal.jsx`, and `ConfirmDialog.jsx` are presentational: receive data and callbacks, and do not perform data access. `MealPlan.jsx` is intentionally static guidance, not profile- or entry-derived data. Destructive actions route through `ConfirmDialog`; food and water entry deletes also expose a six-second undo.

**`src/store.js` (`useData` hook) is the single application-data layer.** On mount it loads the last `RANGE_DAYS` (35) of entries, all foods, and the profile in one `Promise.all`. Creation, food edits, and meal moves wait for Supabase's returned row before updating state. Entry deletion is optimistic but reconciles ambiguous failures with a lookup and restores the snapshot when needed; food deletion and profile edits remain optimistic without general rollback. Preserve those mutation semantics. `App.jsx` only consumes the hook's return value.

**`src/lib/` contains the pure behavior boundaries.** Keep database-independent rules there and covered by their colocated Node tests: local dates (`date`), nutrition and water totals (`nutrition`), meal selection/moves (`meal`), duplicate-safe writes and food search (`write`), deletion reconciliation (`delete`), request staleness/locks (`request`), submission locking (`submission`), and standalone viewport recovery (`viewport`). `App.jsx` coordinates these helpers; do not duplicate their guards in screens.

**Dates are local, never UTC (design §4).** The "today" boundary follows the device timezone. Each entry carries `eaten_on` — a `YYYY-MM-DD` the *client* assigns — so retroactive logging onto past days and day-navigation work without server involvement. All helpers in `src/lib/date.js` build dates from local Y/M/D; do **not** reach for `toISOString()`. The day-nav window is clamped to `RANGE_DAYS`.

**Nutrition math is pure and dependency-free** in `src/lib/nutrition.js` — it aggregates `entries` by `eaten_on` (`dailyTotals`, `remainingProtein`, `pct`, `dailyPace`, `streak`, `weekSeries`, `weeklyAverageSeries`, `entriesByMeal`, `proteinSuggestion`, …) and derives detail-modal values (`proteinPer100g`, `gramsPerServing`, which parses a gram amount from the free-text Hebrew `unit`). The meal suggestion may combine one or two catalog foods and permits at most 10g over the remaining protein target. It is the unit-tested core (`nutrition.test.js`, alongside `date.test.js`). Keep both libs import-free so they stay runnable under `node --test`.

**Meal defaults are client-side and history-aware.** Opening the add sheet selects breakfast from 05:00–11:59, lunch from 12:00–16:59, and dinner otherwise. Foods logged as snacks during the last 14 local dates are forced back to `snack`, matched first by `food_id` and also by normalized name for manual/photo entries. The already-loaded 35-day window is the only history source; keep this rule in `src/lib/meal.js`.

## Data model & RLS (`supabase/migrations/`)

- **`foods` is a shared catalog, NOT per-user.** Migration `0002` dropped its `user_id`; any authenticated user reads/writes all foods (fine for a single-user app). Don't filter foods by user.
- **`entries` and `profile` are per-user**, scoped by an `own rows` policy (`user_id = auth.uid()`). `entries.source` ∈ `('manual','saved','ai')`; `food_id` is a soft link (nulled when a food is deleted). `entries.meal_type` is a non-null `breakfast`, `lunch`, `dinner`, or `snack` value (migration `0006`); older client rows with no value are treated as snacks by `entriesByMeal`.
- **Water uses dated entries, not the food catalog.** Water rows have `entry_kind = 'water'`, a positive `water_ml`, zero protein/calories, and no `food_id`; existing/food rows use `entry_kind = 'food'` and `water_ml = null`. The database enforces this shape. `profile.water_goal_ml` defaults to 3000.
- **`entries.grams` is nullable on purpose** (migration `0004`): it records how much was eaten so `ItemDetailModal` can show amount + protein-per-100g. Legacy and non-gram entries stay null and the UI renders `—`. Migration `0005` backfilled past quick-add rows by reconstructing servings from the protein ratio — read its header comment before trusting old `grams` values.
- **`profile`** holds `protein_goal_g`, `water_goal_ml`, `name` (used in the header greeting), and the AI-quota fields. There is **no signup trigger** — the row is created lazily by the client's first `upsert` (saving a goal, water goal, or name) or by `consume_ai_call` on first AI use, whichever happens first. Any code that reads the profile must tolerate a missing row.
- The **AI daily cap is enforced server-side**: `consume_ai_call(limit)` (SECURITY INVOKER RPC, UTC day) atomically reserves one of 6 calls. Counting client-dated entries would be spoofable; this isn't.

## AI estimate flow (`supabase/functions/analyze-food-photo/`)

`store.js` compresses a camera or gallery image to ~1024px JPEG base64 and posts it with an optional raw photo description to `analyze-food-photo` under the user's JWT; the same function accepts `mode: "text"` for explicit manual nutrition completion. The Edge Function keeps `OPENAI_API_KEY` server-side, rejects missing configuration before reserving `consume_ai_call(6)`, and makes one non-streaming OpenAI Responses call to `gpt-6-astra` with low reasoning, `store: false`, and a strict JSON schema. Photo content combines one `input_image` and labeled untrusted food description; manual content includes `foodName`, `unit`, `quantity`, and optional `totalGrams`, then returns nutrition for one unit only. All results remain editable and persist only through the existing explicit add/save flow; failures retain the manual fallback. `validate.ts` independently validates response shape and non-negativity; `guidance.ts` bounds and constructs request content. Both have colocated Deno tests.

## Conventions

## Local Graphify

- Use the existing local graph in `graphify-out/graph.json` first for architecture, dependencies, code paths, and change-impact investigation: run `graphify query`, `graphify path`, or `graphify affected` from this checkout before broad repository searches. Reuse the findings and inspect the cited current source before editing.
- Do not rebuild the graph at session startup or for routine queries. If the graph is missing, unavailable, or stale for the code in question, use targeted source searches; rebuild only when the task needs an updated graph.
- To rebuild, use `npm run graphify`. The script sources the entire ignored `.env.local` in a subshell, extracts `OPENAI_API_KEY`, and explicitly passes that key to Graphify; rebuilding sends source chunks to OpenAI. Never add the key or graph output to Git.

- **Never create a branch named `codex/**`.** Use a descriptive feature, fix, or chore prefix instead.
- `// ponytail:` comments mark deliberate simplifications and name the upgrade path — read them before "fixing" something that looks too minimal.
- The PWA registration and Hebrew RTL manifest live in `vite.config.js`; keep the listed icon assets and `registerType: "autoUpdate"` behavior intact unless the release behavior is intentionally changing.
- Supabase MCP is connected; the ProCount project id is `ghttttnwebaozbadlonp` (the org also has an unrelated "World Cup 2026 ML Pipeline" project — don't confuse them). Schema changes go through `supabase/migrations/` (or `apply_migration` for the live DB), not ad-hoc SQL.
- Functional spec: `Docs/2026-06-18-procount-design.md` — the source of the `design §N` references in code comments. Visual design reference: `design_handoff_procount/`.
