export function nonNegativeNumber(value) {
  if (String(value ?? "").trim() === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
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
  const { name, protein, calories, grams, unit, save, entryId, foodId, entrySaved } = values;
  const proteinG = nonNegativeNumber(protein);
  const calorieCount = nonNegativeNumber(calories);
  const gramsValue = grams === "" || grams == null ? null : nonNegativeNumber(grams);
  if (proteinG == null || calorieCount == null || gramsValue == null || !entryId || (save && !foodId)) return { entry: null, food: null, error: new Error("invalid_write") };

  const nameValue = (name || "").trim() || "רישום ללא שם";
  const entry = entrySaved
    ? { data: null, error: null, skipped: true }
    : await addEntry({ id: entryId, name: nameValue, protein_g: proteinG, calories: calorieCount, grams: gramsValue, source, meal_type: mealType }, date);
  if (entry.error) return { entry, food: null, error: entry.error };
  if (!save) return { entry, food: null, error: null };

  const food = await saveFood({ id: foodId, name: nameValue, unit: source === "ai" ? "מנה" : unit || "מנה", protein: proteinG, calories: calorieCount });
  return { entry, food, error: food.error };
}
