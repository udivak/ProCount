# Workout muscle drawers implementation plan

**Goal:** Reduce visual clutter in the workout plan and session using one open muscle drawer at a time.
**Spec:** The design approved in this chat: initially closed drawers, first-occurrence muscle order, original exercise order within each group, edit actions inside the corresponding drawer, confirmed target-set progress, and preserved drafts, extra sets, pending saves and the visible rest timer.
**Architecture:** Group existing muscle fields in `src/lib/workout.js`; share a presentational accordion between the two workout screens. Keep collapsed content mounted and hidden, so collapse never resets exercise state. No database or dependency changes.
**Tech stack:** React 18, plain JavaScript, inline styles, existing Node tests.
**Constraints:** Hebrew RTL; keyboard accessible buttons and 44px touch targets. Separate `feature/workout-muscle-drawers` branch from fetched `origin/master`, explicitly approved by the user. Keep unrelated untracked files intact.

## Task 1: Grouping and target progress

- [x] Add tests in `src/lib/workout.test.js` for interleaved groups, whitespace, missing labels, stable order and original item identity; and progress that excludes extra positions, duplicate positions and skipped exercises.
- [x] Run `node --test src/lib/workout.test.js`, then implement `groupExercisesByMuscle(items, getMuscle)` and `targetSetProgress(exercises, sets)` in `src/lib/workout.js` and verify tests pass.

## Task 2: Drawer UI and integration

- [x] Add `src/screens/WorkoutMuscleGroups.jsx`: `groups`, `renderExercise`, optional `summary`; one open group, initially none; native buttons with expanded/controls attributes; keep content mounted under `hidden`.
- [x] In `src/screens/Workouts.jsx`, group the selected template, render cards and edit actions inside drawers, and reset drawers when the selected template changes.
- [x] In `src/screens/WorkoutSession.jsx`, group snapshot muscle labels and show target-set progress plus skipped-exercise count; preserve existing set rows and keep the timer outside. Reset session UI by session id.
- [x] Verify locally with mock data: single open drawer, re-collapse, keyboard, edit placement, template/session switching, preservation of typed values and extra sets, saving/failure while collapsed, and the rest timer outside drawers.
- [x] Run `npm test`, `npm run build`, and `git diff --check`; review the final diff and commit the scoped files.

## Review focus

- Interleaved muscle groups retain the relative exercise order and appear once.
- Extras and skips cannot falsely complete target progress.
- Collapsing during a pending save or after adding a set does not reset state.
- New template/session starts with every drawer closed.
- Hidden panels are absent from keyboard navigation and the visible layout stays RTL.

**Execution:** Implement directly in this chat as authorized by the user; no further design gate.

**Validation:** The helper tests failed before implementation and passed afterward. All 66 Node tests and the production build passed. Local browser checks used isolated mock data and confirmed initial collapse, exclusive expansion, keyboard controls, hidden-input tab exclusion, template/session reset, draft and extra-set preservation, successful and failed saves while folded, progress excluding skips, and a rest timer visible outside drawers. At 390px viewport width, drawer buttons were 58px tall and the plan had no horizontal overflow. Temporary mock files and mock storage were removed after testing. Physical iPhone/PWA and live Supabase writes were not part of these checks.
