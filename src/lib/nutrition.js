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

export function pct(total, goal) {
  return goal > 0 ? Math.min(1, total / goal) : 0;
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

function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
