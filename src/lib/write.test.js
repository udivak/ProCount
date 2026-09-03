import assert from "node:assert/strict";
import test from "node:test";
import { insertOrFind, nonNegativeNumber, saveLoggedFood } from "./write.js";

test("insertOrFind reuses an existing row without inserting", async () => {
  let inserts = 0;
  const result = await insertOrFind({
    row: { id: "food-1" },
    findById: async () => ({ data: { id: "food-1" }, error: null }),
    insert: async () => { inserts += 1; return { data: null, error: null }; },
  });

  assert.deepEqual(result, { data: { id: "food-1" }, error: null, reused: true });
  assert.equal(inserts, 0);
});

test("insertOrFind recovers a row when an insert response is lost", async () => {
  let lookups = 0;
  const result = await insertOrFind({
    row: { id: "entry-1" },
    findById: async () => (++lookups === 1 ? { data: null, error: null } : { data: { id: "entry-1" }, error: null }),
    insert: async () => ({ data: null, error: new Error("network lost") }),
  });

  assert.deepEqual(result, { data: { id: "entry-1" }, error: null, reused: true });
  assert.equal(lookups, 2);
});

test("insertOrFind does not insert when the initial lookup fails", async () => {
  let inserts = 0;
  const result = await insertOrFind({
    row: { id: "food-2" },
    findById: async () => ({ data: null, error: new Error("offline") }),
    insert: async () => { inserts += 1; return { data: { id: "food-2" }, error: null }; },
  });

  assert.equal(result.data, null);
  assert.equal(result.error.message, "offline");
  assert.equal(inserts, 0);
});

test("nonNegativeNumber rejects partial, negative, and non-finite input", () => {
  assert.equal(nonNegativeNumber("12.5"), 12.5);
  assert.equal(nonNegativeNumber(""), 0);
  assert.equal(nonNegativeNumber("12grams"), null);
  assert.equal(nonNegativeNumber("-1"), null);
  assert.equal(nonNegativeNumber("Infinity"), null);
});

test("saveLoggedFood retries only the failed catalog write after an entry succeeds", async () => {
  const values = { name: "חביתה", protein: "12", calories: "220", grams: "150", unit: "מנה", save: true, entryId: "entry-1", foodId: "food-1", entrySaved: false };
  const savedEntry = { id: "entry-1" };
  const catalogError = new Error("catalog offline");
  let entryCalls = 0;
  let foodCalls = 0;
  const addEntry = async (row, date) => {
    entryCalls += 1;
    assert.deepEqual(row, { id: "entry-1", name: "חביתה", protein_g: 12, calories: 220, grams: 150, source: "manual", meal_type: "dinner" });
    assert.equal(date, "2026-09-03");
    return { data: savedEntry, error: null };
  };
  const saveFood = async (row) => {
    foodCalls += 1;
    assert.deepEqual(row, { id: "food-1", name: "חביתה", unit: "מנה", protein: 12, calories: 220 });
    return { data: null, error: catalogError };
  };

  const partial = await saveLoggedFood({ values, date: "2026-09-03", mealType: "dinner", source: "manual", addEntry, saveFood });
  assert.equal(partial.entry.data, savedEntry);
  assert.equal(partial.food.error, catalogError);
  assert.equal(entryCalls, 1);
  assert.equal(foodCalls, 1);

  const retry = await saveLoggedFood({
    values: { ...values, entrySaved: true },
    date: "2026-09-03",
    mealType: "dinner",
    source: "manual",
    addEntry: async () => { throw new Error("entry must not retry"); },
    saveFood: async (row) => {
      foodCalls += 1;
      assert.deepEqual(row, { id: "food-1", name: "חביתה", unit: "מנה", protein: 12, calories: 220 });
      return { data: { id: "food-1" }, error: null };
    },
  });
  assert.equal(retry.entry.skipped, true);
  assert.equal(retry.error, null);
  assert.equal(entryCalls, 1);
  assert.equal(foodCalls, 2);
});
