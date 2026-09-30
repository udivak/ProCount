import { shiftDate, todayLocal } from "./date.js";

export function parseSet(load, reps, mode) {
  const count = Number(reps);
  const weight = String(load ?? "").trim() === "" ? null : Number(load);
  if (!Number.isInteger(count) || count < 1 ||
    (weight == null && mode !== "bodyweight") ||
    (weight != null && (!Number.isFinite(weight) || weight < 0))) return null;
  return { load_kg: weight, reps: count };
}

export function workoutVolume(sets, mode) {
  if (mode !== "external") return null;
  return sets.filter((set) => set.kind === "work" && set.load_kg != null)
    .reduce((sum, set) => sum + Number(set.load_kg) * Number(set.reps), 0);
}

export function progressPoints(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.session_exercise_id;
    if (!groups.has(key)) groups.set(key, { sessionId: row.session_id, date: row.performed_on,
      template: row.template_name, mode: row.load_mode, sets: [] });
    groups.get(key).sets.push(row);
  }
  return [...groups.values()].map((point) => {
    const work = point.sets.filter((set) => set.kind === "work");
    const heaviest = work.reduce((best, set) => !best || Number(set.load_kg) > Number(best.load_kg) ||
      (set.load_kg === best.load_kg && set.reps > best.reps) ? set : best, null);
    return { ...point, heaviest, volume: workoutVolume(work, point.mode) };
  });
}

export function progressSince(range, today = todayLocal()) {
  return shiftDate(today, range === "month" ? -30 : range === "quarter" ? -90 : -365);
}

export function bestAtLoad(points, load) {
  return points.flatMap((point) => point.sets.filter((set) => set.kind === "work"))
    .filter((set) => String(set.load_kg ?? "") === String(load ?? ""))
    .reduce((best, set) => !best || set.reps > best.reps ? set : best, null);
}
