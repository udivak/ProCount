import assert from "node:assert/strict";
import test from "node:test";
import { applyReturnedEntry, defaultMealType, isLearnedSnack, isValidEntryMealUpdate, learnedSnackFoods, resolveAddedMeal } from "./meal.js";

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

test("defaultMealType maps local hours to breakfast, lunch, or dinner", () => {
  assert.equal(defaultMealType(new Date(2026, 8, 17, 4, 59)), "dinner");
  assert.equal(defaultMealType(new Date(2026, 8, 17, 5, 0)), "breakfast");
  assert.equal(defaultMealType(new Date(2026, 8, 17, 11, 59)), "breakfast");
  assert.equal(defaultMealType(new Date(2026, 8, 17, 12, 0)), "lunch");
  assert.equal(defaultMealType(new Date(2026, 8, 17, 16, 59)), "lunch");
  assert.equal(defaultMealType(new Date(2026, 8, 17, 17, 0)), "dinner");
});

test("learnedSnackFoods keeps only non-water snacks from the last 14 local dates", () => {
  const learned = learnedSnackFoods([
    { eaten_on: "2026-09-04", meal_type: "snack", food_id: "bar-1", name: "חטיף חלבון" },
    { eaten_on: "2026-09-10", meal_type: "snack", name: "  שייק   חלבון " },
    { eaten_on: "2026-09-03", meal_type: "snack", food_id: "old-snack", name: "נשנוש ישן" },
    { eaten_on: "2026-09-16", meal_type: "lunch", food_id: "lunch-1", name: "טונה" },
    { eaten_on: "2026-09-16", meal_type: "snack", entry_kind: "water", name: "מים" },
  ], "2026-09-17");

  assert.equal(isLearnedSnack({ id: "bar-1", name: "מוצר אחר" }, learned), true);
  assert.equal(isLearnedSnack({ name: "שייק חלבון" }, learned), true);
  assert.equal(isLearnedSnack({ id: "old-snack", name: "נשנוש ישן" }, learned), false);
  assert.equal(isLearnedSnack({ id: "lunch-1", name: "טונה" }, learned), false);
  assert.equal(isLearnedSnack({ name: "מים" }, learned), false);
});

test("resolveAddedMeal gives a learned snack priority over a selected meal", () => {
  const learned = learnedSnackFoods([
    { eaten_on: "2026-09-17", meal_type: "snack", name: "משקה חלבון" },
  ], "2026-09-17");

  assert.equal(resolveAddedMeal("dinner", { name: "משקה חלבון" }, learned), "snack");
  assert.equal(resolveAddedMeal("lunch", { name: "חזה עוף" }, learned), "lunch");
});
