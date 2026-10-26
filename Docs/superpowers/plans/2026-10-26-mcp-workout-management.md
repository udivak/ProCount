# MCP Workout Management Implementation Plan

> Execute inline with superpowers:executing-plans; one independent branch review at the end.

**Goal:** Log, manage, correct and verify workouts through bounded MCP tools.
**Architecture:** Reuse connector_write transactions, private audit history and existing workout snapshots. Add separate catalog/edit grants and optimistic concurrency checks. No new production dependencies.
**Spec:** Docs/superpowers/specs/2026-10-26-mcp-workouts-design.md
**Tech Stack:** React JS, Supabase PostgreSQL/Edge Functions, Zod, Node tests.

## Constraints and rulings

- Branch feature/mcp-workout-management from fetched origin/master (f66bed8). Project-specific permanent master instruction governs; no worktree.
- Existing logging signatures remain compatible; new management grants default false.
- Read availability can be inspected now; actual connector refresh/production writes require release and the client's exposed tool schema. Continue independent implementation while this remains pending.
- Native execution; use canonical work_state for progress. No production changes during development.

## Review focus

- Cross-client source collisions: same source with different content must conflict, including after cancellation.
- Concurrent UI edits: lock and compare individual row revisions, not only session revision.
- Missing fields: a patch must preserve omitted values, with explicit null clearing notes only.
- Repeated exercise occurrences: identify session exercises by occurrence ID for edits.
- Retry after revoke: authorization precedes returning saved results.

## Task 1: Read contracts and tool registration

Files: supabase/functions/mcp/index.ts, shape.js, shape.test.js, management.ts, management.test.ts.
- [x] Add failing shape tests for IDs/revisions and exact snapshots.
- [x] Add capabilities, get_workout_session and get_write_result with bounded RPCs.
- [x] Add strict schemas for save_exercise/save_workout_template, update_workout_session and set_workout_session_status. Updates require expected_revision; set operations require row IDs/revisions; never infer ownership.
- [x] Verify schema and registration tests with Deno; Node shape tests.

## Task 2: Transactional database behavior

Files: new CLI-created migration, supabase/tests/connector_workout_management.sql.
- [x] Write integration assertions for grants, identity, retries, source dedup, updates, rollback, cancellation and restoration.
- [x] Preserve legacy water/meals writer behind the extended dispatcher; enforce grants before every result/retry.
- [x] Implement explicit owned catalog/template writes and session corrections, audit before/after, stable IDs and source identity.
- [x] Serialize same-day creation through shared DB trigger for all callers; only explicit same-day override accepts a second active session.
- [x] Verify migration and integration assertions in isolated PostgreSQL. Real multi-connection races remain a release verification item; the embedded runtime has one connection.

## Task 3: Permissions and documentation

Files: src/OAuthConsent.jsx, src/screens/Settings.jsx, src/store.js as needed, supabase/README.md, AGENTS.md, CLAUDE.md.
- [x] Add workout_catalog and workout_edit controls; preserve unrelated grants on toggles.
- [x] Update paired instructions, tool contracts, refresh/release instructions.
- [x] Run npm test, Deno tests/typecheck, npm run build, git diff --check.

## Task 4: Review and handoff

- [x] Independent whole-branch review; fix substantive findings and rerun affected checks.
- [ ] Commit reviewed work and prepare draft PR if repository access supports it.
- [ ] Report verified results, remaining client tool refresh and release approval. No claims of live connector writes until performed.

## Verification ledger

- Shape IDs/revisions: RED (undefined revision), then GREEN, 6 shape tests.
- Management schemas: RED (module missing), GREEN; stricter new/removal patches RED then GREEN.
- Integration SQL: RED against pre-feature schema (connector_read missing), GREEN with migration.
- Review regression: explicit second same-day session then ordinary correction RED, guard fix GREEN.
- Review fixes: shared parent locks for set/exercise-status writes; version tombstones prevent restored UUID ABA; all management mutations advertise destructive hints.
- Auth test fixtures mirror live required OAuth client fields/enum types, verified read-only by reviewer.
- MCP HTTP transport lists 7 new tools and dispatches bounded read/write RPCs against mocks. This is not production OAuth acceptance.
- Existing 82 Node tests, 4 Deno tests, Edge typecheck and production build passed during development; final check below.
- No migration, Edge deployment, permission grant or workout data mutation applied to production.

Final verification: 82 Node tests, 4 Deno tests, full Edge typecheck and Vite/PWA build passed. Isolated PostgreSQL tests passed after all review fixes; account-deletion cascade regression was reproduced and fixed. Independent reviewer reran SQL and Deno tests with no remaining Important/Critical findings. PostgreSQL multi-connection concurrency and production OAuth writes remain unverified.
