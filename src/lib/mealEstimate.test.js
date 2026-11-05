import test from "node:test";
import assert from "node:assert/strict";
import { mealWeight, parseMealItems, sumMealEstimates } from "./mealEstimate.js";

test("scales each weighed item exactly once and sums one meal", () => {
  const items = parseMealItems([
    { name: "פרגיות", quantity: "200 גרם" },
    { name: "אורז", quantity: "150 גרם" },
  ]);
  const estimates = [
    { index: 0, calories: 200, protein_g: 25 },
    { index: 1, calories: 120, protein_g: 2 },
  ];
  assert.equal(mealWeight(items), 350);
  assert.deepEqual(sumMealEstimates(items, estimates), { calories: 580, protein_g: 53 });
  assert.deepEqual(sumMealEstimates([{ ...items[0], grams: 100 }], estimates.slice(0, 1)), { calories: 200, protein_g: 25 });
  assert.equal(sumMealEstimates(items, estimates.slice().reverse()), null);
});

test("uses the full free-text portion and rejects incomplete or zero-weight rows", () => {
  const items = parseMealItems([{ name: "אורז", quantity: "חצי כוס" }, { name: "", quantity: "" }]);
  assert.equal(mealWeight(items), null);
  assert.deepEqual(sumMealEstimates(items, [{ index: 0, calories: 100, protein_g: 2 }]), { calories: 100, protein_g: 2 });
  assert.equal(parseMealItems([{ name: "אורז", quantity: "0 גרם" }]), null);
  assert.equal(parseMealItems([{ name: "אורז", quantity: "" }]), null);
});

test("only explicit weight units become grams; free portions remain intact", () => {
  const items = parseMealItems([
    { name: "ביצים", quantity: "2" },
    { name: "פרגיות", quantity: "0,2 ק״ג" },
    { name: "אורז", quantity: "150 g" },
  ]);
  assert.deepEqual(items.map((item) => item.grams), [null, 200, 150]);
  assert.equal(items[0].quantity, "2");
  assert.equal(mealWeight(items), null);
});
