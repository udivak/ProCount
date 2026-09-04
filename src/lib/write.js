import { gramsPerServing } from "./nutrition.js";

export function nonNegativeNumber(value) {
  if (String(value ?? "").trim() === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export const normalizeFoodText = (value) => String(value ?? "").normalize("NFKC").replace(/[\u200B-\u200F\u2060\uFEFF]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("he-IL");
const sameFoodNumber = (left, right) => left != null && right != null && String(left).trim() !== "" && String(right).trim() !== "" && Number.isFinite(Number(left)) && Number(left) === Number(right);

export function searchFoods(foods, query) {
  const needle = normalizeFoodText(query);
  return needle ? foods.filter((food) => normalizeFoodText(food.name).includes(needle)) : foods;
}

// The shared catalog is small and already loaded; compare its unrounded raw values before writing.
export function findExactFood(foods, row, excludeId) {
  return foods.find((food) => food.id !== excludeId
    && normalizeFoodText(food.name) === normalizeFoodText(row.name)
    && normalizeFoodText(food.unit) === normalizeFoodText(row.unit)
    && sameFoodNumber(food.protein_g, row.protein_g)
    && sameFoodNumber(food.calories, row.calories)) || null;
}

export async function insertOrFind({ row, findById, insert }) {
  try {
    const existing = await findById(row.id);
    if (existing.error) return { data: null, error: existing.error, reused: false };
    if (existing.data) return { data: existing.data, error: null, reused: true };

    const created = await insert(row);
    if (created.data) return { data: created.data, error: null, reused: false };

    const afterError = await findById(row.id);
    if (!afterError.error && afterError.data) return { data: afterError.data, error: null, reused: true };
    return { data: null, error: created.error || afterError.error || new Error("insert_failed"), reused: false };
  } catch (error) {
    return { data: null, error, reused: false };
  }
}

export async function saveLoggedFood({ values, date, mealType, source, addEntry, saveFood }) {
  const { name, protein, calories, grams, quantity, unit, save, entryId, foodId, entrySaved } = values;
  const proteinG = nonNegativeNumber(protein);
  const calorieCount = nonNegativeNumber(calories);
  const manual = source === "manual";
  const quantityValue = manual ? Number(quantity) : 1;
  const validQuantity = !manual || (String(quantity ?? "").trim() !== "" && Number.isFinite(quantityValue) && quantityValue > 0);
  const hasGrams = String(grams ?? "").trim() !== "";
  const servingGrams = manual ? gramsPerServing(unit) : null;
  const gramsValue = hasGrams
    ? nonNegativeNumber(grams)
    : servingGrams != null ? servingGrams * quantityValue : null;
  const entryProtein = proteinG * quantityValue;
  const entryCalories = calorieCount * quantityValue;
  const validEntryValues = Number.isFinite(entryProtein) && Number.isFinite(entryCalories) && (gramsValue == null || Number.isFinite(gramsValue));
  if (proteinG == null || calorieCount == null || !validQuantity || (hasGrams && gramsValue == null) || !validEntryValues || !entryId || (save && !foodId)) return { entry: null, food: null, error: new Error("invalid_write") };

  const nameValue = (name || "").trim() || "רישום ללא שם";
  const entry = entrySaved
    ? { data: null, error: null, skipped: true }
    : await addEntry({ id: entryId, name: nameValue, protein_g: entryProtein, calories: entryCalories, grams: gramsValue, source, meal_type: mealType }, date);
  if (entry.error) return { entry, food: null, error: entry.error };
  if (!save) return { entry, food: null, error: null };

  const food = await saveFood({ id: foodId, name: nameValue, unit: source === "ai" ? "מנה" : unit || "מנה", protein: proteinG, calories: calorieCount });
  return { entry, food, error: food.error };
}
