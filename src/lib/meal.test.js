import assert from "node:assert/strict";
import test from "node:test";
import { applyReturnedEntry, isValidEntryMealUpdate } from "./meal.js";

test("isValidEntryMealUpdate accepts only a nonblank ID and the four exact meal types", () => {
  for (const mealType of ["breakfast", "lunch", "dinner", "snack"]) {
    assert.equal(isValidEntryMealUpdate("entry-1", mealType), true);
  }

  for (const [id, mealType] of [
    ["", "snack"],
    [null, "snack"],
    ["entry-1", "brunch"],
    ["entry-1", " snack"],
    ["entry-1", "SNACK"],
  ]) {
    assert.equal(isValidEntryMealUpdate(id, mealType), false);
  }
});

test("applyReturnedEntry leaves local entries unchanged for a missing or failed response", () => {
  const entries = [{ id: "entry-1", meal_type: "lunch" }];

  assert.strictEqual(applyReturnedEntry(entries, { data: null, error: null }), entries);
  assert.strictEqual(applyReturnedEntry(entries, { data: null, error: new Error("network") }), entries);
});

test("applyReturnedEntry replaces only the matching entry with the returned row", () => {
  const before = [
    { id: "entry-1", meal_type: "breakfast", name: "יוגורט" },
    { id: "entry-2", meal_type: "lunch", name: "טונה" },
    { id: "entry-3", meal_type: "snack", name: "תפוח" },
  ];
  const returned = { id: "entry-2", meal_type: "dinner", name: "טונה", updated_at: "2026-09-03T10:00:00Z" };

  const after = applyReturnedEntry(before, { data: returned, error: null });

  assert.deepEqual(after, [before[0], returned, before[2]]);
  assert.strictEqual(after[0], before[0]);
  assert.strictEqual(after[2], before[2]);
});
