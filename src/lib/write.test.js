import assert from "node:assert/strict";
import test from "node:test";
import { findExactFood, insertOrFind, nonNegativeNumber, saveLoggedFood } from "./write.js";

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

test("findExactFood reuses a normalized exact catalog match", () => {
  const foods = [{ id: "food-1", name: "  חזה   עוף ", unit: " מנה ", protein_g: "25.0", calories: "165" }];
  const row = { name: "חזה עוף", unit: "מנה", protein_g: 25, calories: 165 };

  assert.equal(findExactFood(foods, row)?.id, "food-1");
});

test("findExactFood ignores invisible bidi format characters", () => {
  const foods = [{ id: "food-1", name: "חזה\u200F עוף\u200B", unit: "מ\u2060נה\uFEFF", protein_g: 25, calories: 165 }];
  const row = { name: "חזה עוף", unit: "מנה", protein_g: 25, calories: 165 };

  assert.equal(findExactFood(foods, row)?.id, "food-1");
});

test("findExactFood requires every normalized catalog field", () => {
  const food = { id: "food-1", name: "חזה עוף", unit: "מנה", protein_g: 25, calories: 165 };
  const exact = { name: "חזה עוף", unit: "מנה", protein_g: 25, calories: 165 };

  for (const row of [
    { ...exact, name: "חזה הודו" },
    { ...exact, unit: "100 גרם" },
    { ...exact, protein_g: 24 },
    { ...exact, calories: 164 },
  ]) assert.equal(findExactFood([food], row), null);
});

test("findExactFood excludes the row being edited", () => {
  const food = { id: "food-1", name: "חזה עוף", unit: "מנה", protein_g: 25, calories: 165 };
  const row = { name: "חזה עוף", unit: "מנה", protein_g: 25, calories: 165 };

  assert.equal(findExactFood([food], row, "food-1"), null);
});

test("saveLoggedFood retries only the failed catalog write after an entry succeeds", async () => {
  const values = { name: "חביתה", protein: "12", calories: "220", grams: "150", quantity: "1", unit: "מנה", save: true, entryId: "entry-1", foodId: "food-1", entrySaved: false };
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

test("saveLoggedFood scales a manual entry while retaining base catalog values", async () => {
  const values = { name: "סלמון", protein: "10", calories: "100", grams: "", quantity: "2", unit: "100 גרם", save: true, entryId: "entry-3", foodId: "food-3", entrySaved: false };
  const result = await saveLoggedFood({
    values,
    date: "2026-09-03",
    mealType: "lunch",
    source: "manual",
    addEntry: async (row) => {
      assert.deepEqual(row, { id: "entry-3", name: "סלמון", protein_g: 20, calories: 200, grams: 200, source: "manual", meal_type: "lunch" });
      return { data: { id: "entry-3" }, error: null };
    },
    saveFood: async (row) => {
      assert.deepEqual(row, { id: "food-3", name: "סלמון", unit: "100 גרם", protein: 10, calories: 100 });
      return { data: { id: "food-3" }, error: null };
    },
  });

  assert.equal(result.error, null);
});

test("saveLoggedFood keeps an explicit manual weight total and leaves non-gram units unknown", async () => {
  const captureEntry = async (values) => {
    let saved;
    const result = await saveLoggedFood({
      values,
      date: "2026-09-03",
      mealType: "snack",
      source: "manual",
      addEntry: async (row) => { saved = row; return { data: row, error: null }; },
      saveFood: async () => ({ data: null, error: null }),
    });
    assert.equal(result.error, null);
    return saved;
  };

  assert.deepEqual(await captureEntry({ name: "יוגורט", protein: "20", calories: "150", grams: "275", quantity: "0.5", unit: "100 גרם", save: false, entryId: "entry-4" }),
    { id: "entry-4", name: "יוגורט", protein_g: 10, calories: 75, grams: 275, source: "manual", meal_type: "snack" });
  assert.deepEqual(await captureEntry({ name: "אבקה", protein: "10", calories: "100", grams: "", quantity: "2", unit: "סקופ", save: false, entryId: "entry-5" }),
    { id: "entry-5", name: "אבקה", protein_g: 20, calories: 200, grams: null, source: "manual", meal_type: "snack" });
});

test("saveLoggedFood rejects invalid manual quantities before writing", async () => {
  for (const quantity of ["", "0", "-1", "not a number", "Infinity"]) {
    let writes = 0;
    const result = await saveLoggedFood({
      values: { name: "חביתה", protein: "12", calories: "220", grams: "100", quantity, unit: "מנה", save: false, entryId: "entry-6" },
      date: "2026-09-03",
      mealType: "dinner",
      source: "manual",
      addEntry: async () => { writes += 1; return { data: null, error: null }; },
      saveFood: async () => { writes += 1; return { data: null, error: null }; },
    });
    assert.equal(result.error?.message, "invalid_write");
    assert.equal(writes, 0);
  }
});

test("saveLoggedFood rejects finite quantities whose scaled values overflow", async () => {
  let writes = 0;
  const result = await saveLoggedFood({
    values: { name: "חביתה", protein: "10", calories: "100", grams: "", quantity: "1e308", unit: "100 גרם", save: true, entryId: "entry-7", foodId: "food-7" },
    date: "2026-09-03",
    mealType: "dinner",
    source: "manual",
    addEntry: async () => { writes += 1; return { data: null, error: null }; },
    saveFood: async () => { writes += 1; return { data: null, error: null }; },
  });

  assert.equal(result.error?.message, "invalid_write");
  assert.equal(writes, 0);
});

test("saveLoggedFood preserves an AI entry when its optional catalog food is reused", async () => {
  const values = { name: "יוגורט", protein: "20", calories: "150", grams: "100", quantity: "2", unit: "מנה", save: true, entryId: "entry-2", foodId: "food-2", entrySaved: false };
  let entryCalls = 0;
  const result = await saveLoggedFood({
    values,
    date: "2026-09-03",
    mealType: "snack",
    source: "ai",
    addEntry: async (row) => {
      entryCalls += 1;
      assert.deepEqual(row, { id: "entry-2", name: "יוגורט", protein_g: 20, calories: 150, grams: 100, source: "ai", meal_type: "snack" });
      return { data: { id: "entry-2" }, error: null };
    },
    saveFood: async (row) => {
      assert.deepEqual(row, { id: "food-2", name: "יוגורט", unit: "מנה", protein: 20, calories: 150 });
      return { data: { id: "existing-food" }, error: null, reused: true };
    },
  });

  assert.equal(entryCalls, 1);
  assert.equal(result.entry.data.id, "entry-2");
  assert.equal(result.food.reused, true);
  assert.equal(result.error, null);
});
