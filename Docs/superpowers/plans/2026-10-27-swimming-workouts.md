# Swimming Workouts Implementation Plan

> Execution: native in this session, with a fresh whole-branch review under superpowers:executing-plans. User approved implementation and local preview; no release.

**Goal:** Record pool swimming after a workout alongside strength workouts.

**Architecture:** Add typed templates/sessions and one-to-one swim details. Atomic first-party RPCs create/edit/cancel swims; store owns queries; presentational swim form uses pure validated math. Shared history/weekly counts, separate swim progress and MCP read shapes.

**Tech Stack:** Existing React/JS/inline styles, Supabase PostgreSQL, Node tests; no new production dependencies.

**Spec:** Approved proposal: `Docs/superpowers/specs/2026-10-27-swimming-workouts.md`.

## Global Constraints
- Branch feature/swimming-workouts from fetched origin/master; no worktree, no production writes/deployment.
- Hebrew RTL; local dates; optional distance stays null. Duration includes rests.
- No calories, timer, intervals, watches, sea, or connector swimming writes.
- All existing strength mutation semantics and OAuth grants remain intact.

## Review Focus
- Ambiguous save/retry: immutable attempt UUID/payload; no duplicate or silent changed-payload acceptance.
- Concurrent edits/cancel: parent revision/lock, stale writes rejected.
- Missing distance: no zero distance/pace and honest aggregate coverage.
- Cross-user/OAuth: own rows, first-party-only swim mutations; strength tools reject swim targets.
- Same date: allow strength+swim; reject second swim and offer existing record.

### Task 1: Pure swimming rules
Files: src/lib/swimming.js and swimming.test.js.
- [x] Tests first: direct/distance-by-lengths, invalid duration/seconds/count, missing distance, pace rounding and missing coverage.
- [x] Implement parseSwim(draft), swimPace(details), swimSummary(sessions), swimLabel(details), stroke labels.
- [x] Run node --test src/lib/swimming.test.js (red then green).

### Task 2: Database and MCP boundaries
Files: swimming migration; supabase/tests/swimming.sql; MCP index.ts, shape.js/tests.
- [x] Write SQL assertions and shaping tests before implementation; run red.
- [x] Typed templates/sessions with strength defaults; one swim template per user; detailed table, RLS and grants.
- [x] save_swim_workout(UUID, expected revision, date, JSON details, notes, timezone), set_swim_workout_status(request UUID, session UUID, revision, status); atomic, retry-safe, revision checked.
- [x] Add database guards against strength tools mutating swimming; add swim summary to both MCP read paths.
- [x] Run isolated DB assertions including existing connector tests, real concurrency check and Node shaping tests.

### Task 3: Store and UI
Files: src/store.js, src/screens/Workouts.jsx, new SwimmingSession.jsx, SwimmingProgress.jsx.
- [x] Add store save/cancel/swim progress; shared history with details and weekly strength/swim split.
- [x] Dedicated swimming card/form, existing-date recovery, frozen retry payload, loading/error states, confirm cancellation.
- [x] Swim history detail/edit, separate progress selector and totals/coverage.
- [x] Browser acceptance: complete create/read/edit/cancel, lengths/manual/no distance, failure+retry, mobile RTL; strength flow regression.

### Task 4: Review and local delivery
- [x] npm test; npm run build; MCP Deno checks; git diff --check; SQL ownership/rollback/concurrency checks.
- [x] Fresh branch review; resolve material findings and rerun relevant checks.
- [x] Commit reviewed changes, leave local isolated preview running and open it for user. Report real versus simulated validation and production untouched.

## Execution notes
2026-10-27: User approved the proposed scope and requested new branch + local preview. Fetched origin/master e67f7e5 and created feature/swimming-workouts. Existing untracked files preserved. Docker Desktop started for local Supabase. Proposal assumptions confirmed: pool, after-workout summary.


### Verification ledger
- Pure swimming tests: observed failure before implementation; 4 pass. MCP shape test: observed missing kind failure, then pass.
- SQL suite: observed missing RPC failure, then corrected variable qualification and generic-trigger field access; final rollback suite passes.
- Local PostgREST initially embedded details as an array; added UNIQUE(session_id,user_id), verified object shape by actual REST and full browser refresh. Reviewer compared all nine final SQL bodies with pg_proc in the tested DB.
- 87 Node tests pass; 4 Deno MCP transport/schema tests pass; MCP Deno typecheck passes; Vite production build passes (bundle-size warning remains).
- Actual local Supabase browser at 390px: create/read/edit, date in past, unknown distance, lengths math, duplicate recovery, cancel/restore, strength start/set/complete on same date, weekly split and distance coverage.
- Local proxy dropped responses after committed restore/create. Repeated confirmation reused one request; create attempt persisted through full reload and retried to one saved session.
- Two independent database connections: same-request creations overlap and produce one session/audit row. Edit/cancel serialize; stale cancellation conflicts.
- Existing connector SQL regression suite passes using local OAuth/strength fixtures; no live backend calls or production changes.
- Fresh independent review corrected confirmation stale closure, FK embedding, history filter response ordering and pagination of discarded responses.
- Ruling: preserve the current checkout and existing untracked files; no worktree, push, PR, merge or production release. Use a separate local Supabase project and synthetic test account for the preview.
- Physical iPhone/PWA hardware and production integration remain release checks.
