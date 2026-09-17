import { MEAL_TYPES } from "./nutrition.js";
import { shiftDate } from "./date.js";
import { normalizeFoodText } from "./write.js";

export function defaultMealType(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "breakfast";
  if (hour >= 12 && hour < 17) return "lunch";
  return "dinner";
}

// The entry query already includes 35 local dates, so this stays client-only.
export function learnedSnackFoods(entries, today) {
  const earliest = shiftDate(today, -13);
  return entries.reduce((learned, entry) => {
    if (entry.entry_kind === "water" || entry.meal_type !== "snack" || entry.eaten_on < earliest || entry.eaten_on > today) return learned;
    if (entry.food_id) learned.ids.add(entry.food_id);
    const name = normalizeFoodText(entry.name);
    if (name) learned.names.add(name);
    return learned;
  }, { ids: new Set(), names: new Set() });
}

export function isLearnedSnack(food, learned) {
  if (!food || !learned) return false;
  return learned.ids.has(food.id || food.food_id) || learned.names.has(normalizeFoodText(food.name));
}

export function resolveAddedMeal(mealType, food, learned) {
  return isLearnedSnack(food, learned) ? "snack" : mealType;
}

export function isValidEntryMealUpdate(id, mealType) {
  return typeof id === "string" && id.trim() !== "" && MEAL_TYPES.includes(mealType);
}

export function applyReturnedEntry(entries, result) {
  if (result?.error || !result?.data) return entries;
  return entries.map((entry) => entry.id === result.data.id ? result.data : entry);
}
