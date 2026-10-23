// Shared trust boundary for the browser and the Edge Function; model keys are never DB IDs.
export function validChatDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 &&
    date.getDate() === d;
}
const keys = [
  "draftKey",
  "kind",
  "date",
  "mealType",
  "name",
  "quantityText",
  "protein_g",
  "calories",
  "grams",
  "water_ml",
  "confidence",
  "assumptions",
];
const nonnegative = (n) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
export function validateChatItems(items, { oldest, today }) {
  return Array.isArray(items) && items.length <= 30 &&
    new Set(items.map((i) => i?.draftKey)).size === items.length &&
    items.every((i) =>
      i && Object.keys(i).length === keys.length &&
      keys.every((k) => Object.hasOwn(i, k)) &&
      typeof i.draftKey === "string" && i.draftKey.length > 0 &&
      i.draftKey.length <= 100 &&
      validChatDate(i.date) && i.date >= oldest && i.date <= today &&
      ["breakfast", "lunch", "dinner", "snack"].includes(i.mealType) &&
      typeof i.name === "string" && i.name.trim().length > 0 &&
      i.name.length <= 200 &&
      typeof i.quantityText === "string" && i.quantityText.length <= 300 &&
      ["low", "medium", "high"].includes(i.confidence) &&
      Array.isArray(i.assumptions) && i.assumptions.length <= 10 &&
      i.assumptions.every((a) => typeof a === "string" && a.length <= 300) &&
      nonnegative(i.protein_g) && nonnegative(i.calories) &&
      (i.kind === "food" && i.water_ml === null &&
          (i.grams === null || nonnegative(i.grams) && i.grams > 0) ||
        i.kind === "water" && Number.isInteger(i.water_ml) && i.water_ml > 0 &&
          i.grams === null && i.protein_g === 0 && i.calories === 0)
    );
}
export function prepareChatRows(items, bounds, newId) {
  if (!items.length || !validateChatItems(items, bounds)) {
    throw Error("invalid_draft");
  }
  return Object.freeze(items.map((i) =>
    Object.freeze({
      id: newId(),
      name: [i.name, i.quantityText, i.assumptions[0]].filter(Boolean).join(
        " · ",
      ),
      eaten_on: i.date,
      meal_type: i.mealType,
      entry_kind: i.kind,
      protein_g: i.protein_g,
      calories: i.calories,
      grams: i.grams,
      water_ml: i.water_ml,
      source: i.kind === "food" ? "ai" : "manual",
      food_id: null,
    })
  ));
}
export const CHAT_ENTRY_FIELDS =
  "id,name,eaten_on,meal_type,entry_kind,protein_g,calories,grams,water_ml,source,food_id";
const fields = CHAT_ENTRY_FIELDS.split(",");
export function sameChatRow(a, b) {
  return fields.every((k) =>
    ["protein_g", "calories", "grams", "water_ml"].includes(k)
      ? (a[k] == null || b[k] == null
        ? a[k] === b[k]
        : Number(a[k]) === Number(b[k]))
      : a[k] === b[k]
  );
}
export function sameChatContext(before, after, ignoreIds = []) {
  const clean = (rows) =>
    rows.filter((r) => !ignoreIds.includes(r.id)).sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  const a = clean(before), b = clean(after);
  return a.length === b.length && a.every((row, i) => sameChatRow(row, b[i]));
}
export async function saveChatRows(rows, addEntry, findById) {
  const result = { saved: [], failed: [], uncertain: [] };
  for (const row of rows) {
    let outcome;
    try {
      outcome = await addEntry(row, row.eaten_on);
    } catch { /* Resolve ambiguous inserts using the original UUID. */ }
    if (outcome?.data && sameChatRow(row, outcome.data)) {
      result.saved.push(row);
      continue;
    }
    let lookup;
    try {
      lookup = await findById(row.id);
    } catch {
      lookup = { error: true };
    }
    if (
      lookup?.error || !lookup || lookup.data && !sameChatRow(row, lookup.data)
    ) result.uncertain.push(row);
    else if (lookup.data) result.saved.push(row);
    else result.failed.push(row);
  }
  return result;
}
export function chatTotals(items) {
  const totals = {};
  for (const i of items) {
    const day = totals[i.date] ||= {};
    for (const key of [i.mealType, "total"]) {
      const t = day[key] ||= { protein: 0, calories: 0, water: 0 };
      t.protein += i.protein_g || 0;
      t.calories += i.calories || 0;
      t.water += i.water_ml || 0;
    }
  }
  return totals;
}
export const isChatRequestCurrent = (isCurrent, requestToday, today) =>
  isCurrent() && requestToday === today;
