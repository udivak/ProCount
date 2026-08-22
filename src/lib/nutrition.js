// Pure nutrition math (design §9). Entries: { eaten_on:'YYYY-MM-DD', protein_g, calories }.
// No imports → standalone-testable under `node --test`.

export function dailyTotals(entries, date) {
  let protein = 0, calories = 0, count = 0;
  for (const e of entries) {
    if (e.eaten_on !== date) continue;
    protein += Number(e.protein_g) || 0;
    calories += Number(e.calories) || 0;
    count++;
  }
  return { protein, calories, count };
}

export function remainingProtein(total, goal) {
  return Math.max(0, goal - total);
}

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

// Returns populated meal groups in display order. Legacy entries (before meal_type)
// belong in snacks rather than being hidden or guessed from their creation time.
export function entriesByMeal(entries) {
  const groups = Object.fromEntries(MEAL_TYPES.map((type) => [type, []]));
  for (const entry of entries) groups[groups[entry.meal_type] ? entry.meal_type : "snack"].push(entry);
  return MEAL_TYPES.map((type) => ({
    type,
    entries: groups[type],
    protein: groups[type].reduce((sum, entry) => sum + (Number(entry.protein_g) || 0), 0),
  })).filter((group) => group.entries.length);
}

// Finds the closest saved-food serving or two-serving combination that covers the
// remaining protein without exceeding it by more than maxOverage grams.
export function proteinSuggestion(foods, remaining, maxOverage = 10) {
  const needed = Number(remaining) || 0;
  if (!(needed > 0)) return null;
  const eligible = foods.filter((food) => (Number(food.protein_g) || 0) > 0);
  let best = null;
  const consider = (chosen) => {
    const protein = chosen.reduce((sum, food) => sum + (Number(food.protein_g) || 0), 0);
    if (protein < needed || protein > needed + maxOverage) return;
    if (!best || protein < best.protein) best = { foods: chosen, protein };
  };
  for (let i = 0; i < eligible.length; i++) {
    consider([eligible[i]]);
    for (let j = i + 1; j < eligible.length; j++) consider([eligible[i], eligible[j]]);
  }
  return best;
}

export function pct(total, goal) {
  return goal > 0 ? Math.min(1, total / goal) : 0;
}

// Compare protein-goal progress with the elapsed local calendar day. Historical
// days omit this calculation so they never use the current clock.
export function dailyPace(total, goal, now = new Date()) {
  const elapsed = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  const progressPct = Math.round(pct(total, goal) * 100);
  const elapsedPct = Math.round(elapsed * 100);
  const delta = progressPct - elapsedPct;
  const status = delta >= 0 ? "excellent" : delta >= -15 ? "good" : "behind";
  return { progressPct, elapsedPct, status };
}

// { 'YYYY-MM-DD': proteinTotal }
export function proteinByDay(entries) {
  const m = {};
  for (const e of entries) m[e.eaten_on] = (m[e.eaten_on] || 0) + (Number(e.protein_g) || 0);
  return m;
}

// Consecutive days meeting goal, counting back from `from`. An in-progress today
// that hasn't hit goal yet does NOT break the streak (we start from yesterday).
export function streak(byDay, goal, from = new Date()) {
  if (!(goal > 0)) return 0;
  let count = 0;
  const d = new Date(from);
  if ((byDay[isoLocal(d)] || 0) < goal) d.setDate(d.getDate() - 1);
  while ((byDay[isoLocal(d)] || 0) >= goal) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// Protein per day over the given dates (oldest first) for the bar chart.
export function weekSeries(entries, dates) {
  const byDay = proteinByDay(entries);
  return dates.map((date) => ({ date, protein: byDay[date] || 0 }));
}

// Average protein per day for each week bucket (sum ÷ days in bucket, empty days
// count as zero) — comparable to the daily goal line. `weeks` is an array of
// date-string arrays (see lastNWeeks), returned in the same order.
export function weeklyAverageSeries(entries, weeks) {
  const byDay = proteinByDay(entries);
  return weeks.map((dates) => {
    const sum = dates.reduce((a, d) => a + (byDay[d] || 0), 0);
    return { dates, protein: dates.length ? Math.round(sum / dates.length) : 0 };
  });
}

// Mean calories per day with at least one entry, over the given dates.
export function avgCaloriesPerActiveDay(entries, dates) {
  const set = new Set(dates);
  const byDay = {};
  for (const e of entries) {
    if (!set.has(e.eaten_on)) continue;
    byDay[e.eaten_on] = (byDay[e.eaten_on] || 0) + (Number(e.calories) || 0);
  }
  const vals = Object.values(byDay);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

export function average(values) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

// Protein per 100g of food eaten, derived from total protein and grams eaten.
// Returns null when grams is missing/zero/negative (legacy or quick-add entries)
// so the UI can show "—" instead of Infinity/NaN.
export function proteinPer100g(proteinG, grams) {
  const g = Number(grams);
  if (!(g > 0)) return null;
  return ((Number(proteinG) || 0) / g) * 100;
}

// Grams in one serving of a saved food, read from its free-text unit ("100 גרם" → 100).
// ponytail: heuristic parse — a number immediately followed by a grams token. Non-gram
// units ("מנה", "2 ביצים") return null so quick-add leaves grams unknown ("—"). Upgrade
// path: a structured serving_g column on foods if units ever get too varied to parse.
export function gramsPerServing(unit) {
  const m = String(unit || "").match(/(\d+(?:\.\d+)?)\s*(?:גרם|גר|g)/i);
  return m ? Number(m[1]) : null;
}

function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
