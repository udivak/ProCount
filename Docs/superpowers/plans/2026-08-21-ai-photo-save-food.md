# Implementation Plan: Save corrected AI photo foods

## Task 1: Persist opted-in AI foods

Update `addAi` in `src/store.js` to read `save`, create the normal AI entry, and—when selected—insert the corrected values into `foods` with unit `מנה` and update local foods state.

Acceptance criteria:
- An AI entry is created whether `save` is true or false.
- With `save: true`, a reusable food with the corrected macros is persisted and appears in local state.
- Existing manual and quick-add behavior is unchanged.

Verification: `npm test` and `npm run build`.

## Task 2: Offer opt-in saving after AI analysis

Pass the existing save-toggle handler to the completed photo form in `src/screens/AddSheet.jsx` and enable its existing checkbox.

Acceptance criteria:
- The successful AI state shows an unchecked `שמור למאכלים שלי` control.
- User edits and checkbox state reach `addAi` when confirming.
- The manual form still works as before.

Verification: `npm test`, `npm run build`, and inspect the production UI path.

## Checkpoint

- Tests and production build pass.
- Photo result can be logged alone or logged and saved for Quick Add.
