export const MAX_MEAL_ITEMS = 12;
export const MAX_MEAL_TEXT = 200;

export function parseMealItems(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_MEAL_ITEMS) return null;
  const items = [];
  for (const row of rows) {
    if (typeof row?.name !== "string" || typeof row.quantity !== "string") return null;
    const name = row.name.trim();
    const quantity = row.quantity.trim();
    if (!name && !quantity) continue;
    if (!name || !quantity || name.length > MAX_MEAL_TEXT || quantity.length > MAX_MEAL_TEXT) return null;
    const match = quantity.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(גרם|גר['׳]|g|קילו(?:גרם)?|ק["״]ג|kg)$/i);
    const kilograms = match && /^(?:ק|kg)/i.test(match[2] || "");
    const grams = match ? Number(match[1].replace(",", ".")) * (kilograms ? 1000 : 1) : null;
    if (grams !== null && (!Number.isFinite(grams) || grams <= 0)) return null;
    items.push({ name, quantity, grams });
  }
  return items;
}

export function mealWeight(items) {
  if (!items.length || items.some((item) => item.grams === null)) return null;
  const total = items.reduce((sum, item) => sum + item.grams, 0);
  return Number.isFinite(total) ? total : null;
}

export function sumMealEstimates(items, estimates) {
  if (!Array.isArray(estimates) || estimates.length !== items.length) return null;
  let calories = 0;
  let protein_g = 0;
  for (const [index, item] of items.entries()) {
    const estimate = estimates[index];
    if (estimate?.index !== index || ![estimate.calories, estimate.protein_g].every((value) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0)) return null;
    const multiplier = item.grams === null ? 1 : item.grams / 100;
    calories += estimate.calories * multiplier;
    protein_g += estimate.protein_g * multiplier;
  }
  return Number.isFinite(calories) && Number.isFinite(protein_g) ? { calories, protein_g } : null;
}
