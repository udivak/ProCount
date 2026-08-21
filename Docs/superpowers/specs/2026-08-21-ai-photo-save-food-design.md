# AI photo result: save corrected food

## Goal

Let a user turn an AI-recognized food photo into a reusable saved food after correcting the AI result, without making saving mandatory.

## User flow

1. The user takes or selects a food photo in the Photo tab.
2. After successful analysis, the app displays the editable name, protein, calories, and optional grams-eaten fields as it does today.
3. Beneath those fields, the app shows an unchecked `שמור למאכלים שלי` checkbox.
4. On `אשר והוסף`, the app always creates an `entries` row with `source = 'ai'` for the selected date.
5. If the checkbox is checked, the app also creates a `foods` row from the corrected name, protein, and calories. Its unit is `מנה` (serving), because the AI result describes the photographed portion. The entry's optional grams value remains entry-specific and is not used as the reusable food's unit.
6. The saved food is added optimistically to local state, making it available immediately in Quick Add and My Foods.

## Architecture

The change uses the existing `form.save` flag, `addAi`, and `saveFood`/food persistence patterns in `src/store.js`. `App.jsx` initializes the flag when an AI estimate arrives and passes the existing toggle handler to the photo result form. `AddSheet.jsx` reuses the manual form's save control in the successful-photo state.

No migration is required: the existing shared `foods` catalog already stores name, unit, protein, and calories.

## Error handling

Saving remains local-optimistic, consistent with the existing data layer. A failure to analyze a photo still falls back to manual entry and never exposes the save option. The AI entry is still created whether or not the user chooses to save a reusable food.

## Verification

- Extend or add focused data-layer tests for AI add behavior with and without `save`.
- Run `npm test`.
- Run `npm run build`.
- Manually verify the successful photo state exposes the unchecked control and that a checked submission places the food in Quick Add.
