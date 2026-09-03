import { MEAL_TYPES } from "./nutrition.js";

export function isValidEntryMealUpdate(id, mealType) {
  return typeof id === "string" && id.trim() !== "" && MEAL_TYPES.includes(mealType);
}

export function applyReturnedEntry(entries, result) {
  if (result?.error || !result?.data) return entries;
  return entries.map((entry) => entry.id === result.data.id ? result.data : entry);
}
