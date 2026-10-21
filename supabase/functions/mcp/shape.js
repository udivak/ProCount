// Pure shaping for the read-only MCP tools. Reuses the app's own nutrition/workout
// math from src/lib so the AI sees the same numbers as the PWA. No Supabase access
// here → testable under `node --test` like the rest of src/lib.
import {
  CALORIE_GOAL, avgCaloriesPerActiveDay, dailyTotals, dailyWaterTotal, entriesByMeal,
  gramsPerServing, proteinByDay, proteinPer100g, streak,
} from "../../../src/lib/nutrition.js";
import { shiftDate } from "../../../src/lib/date.js";
import { progressPoints, workoutVolume } from "../../../src/lib/workout.js";

// ponytail: single user in Israel. The Edge runtime is UTC, so "today" is derived
// from this zone; move it to profile if the user ever logs from elsewhere.
export const TIMEZONE = "Asia/Jerusalem";
export const todayIn = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d); // YYYY-MM-DD

const round = (n, digits = 1) => Math.round((Number(n) || 0) * 10 ** digits) / 10 ** digits;

// Inclusive list of YYYY-MM-DD dates, oldest first. Throws a user-facing message.
export function dateRange(from, to, maxDays) {
  for (const d of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || shiftDate(d, 0) !== d) throw new Error(`Invalid date "${d}", expected YYYY-MM-DD`);
  }
  if (from > to) throw new Error("`from` must be on or before `to`");
  const dates = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) {
    dates.push(d);
    if (dates.length > maxDays) throw new Error(`Range too long: at most ${maxDays} days`);
  }
  return dates;
}

export function shapeProfile(row, today) {
  return {
    name: row?.name || null,
    protein_goal_g: Number(row?.protein_goal_g) > 0 ? Number(row.protein_goal_g) : 160,
    water_goal_ml: Number(row?.water_goal_ml) > 0 ? Number(row.water_goal_ml) : 3000,
    calorie_goal_kcal: CALORIE_GOAL,
    workout_goal_weekly: Number(row?.workout_goal_weekly) > 0 ? Number(row.workout_goal_weekly) : 3,
    today,
    timezone: TIMEZONE,
  };
}

const shapeEntry = (e) => ({
  name: e.name, protein_g: round(e.protein_g), calories: Math.round(Number(e.calories) || 0),
  grams: e.grams == null ? null : round(e.grams), source: e.source,
});

export function shapeNutrition(entries, profile, dates, includeEntries) {
  const goal = profile.protein_goal_g;
  const days = dates.map((date) => {
    const totals = dailyTotals(entries, date);
    const day = {
      date,
      protein_g: round(totals.protein),
      calories: Math.round(totals.calories),
      water_ml: Math.round(dailyWaterTotal(entries, date)),
      food_entries: totals.count,
      protein_goal_met: totals.protein >= goal,
    };
    if (includeEntries) {
      day.meals = entriesByMeal(entries.filter((e) => e.eaten_on === date))
        .map((m) => ({ meal: m.type, protein_g: round(m.protein), entries: m.entries.map(shapeEntry) }));
    }
    return day;
  });
  const avg = (key) => round(days.reduce((sum, d) => sum + d[key], 0) / days.length);
  const to = dates[dates.length - 1];
  return {
    goals: { protein_g: goal, water_ml: profile.water_goal_ml, calories_kcal: profile.calorie_goal_kcal },
    summary: {
      days: days.length,
      avg_protein_g: avg("protein_g"),
      avg_water_ml: avg("water_ml"),
      avg_calories_per_logged_day: avgCaloriesPerActiveDay(entries, dates),
      days_protein_goal_met: days.filter((d) => d.protein_goal_met).length,
      // streak() reads local dates; noon keeps `to` on the same day in any runtime zone.
      protein_streak_ending_to: streak(proteinByDay(entries), goal, new Date(`${to}T12:00:00`)),
    },
    days,
  };
}

export function shapeFood(f) {
  const grams = gramsPerServing(f.unit);
  const per100 = proteinPer100g(f.protein_g, grams);
  return {
    id: f.id, name: f.name, unit: f.unit, protein_g: round(f.protein_g),
    calories: Math.round(Number(f.calories) || 0), default_qty: Number(f.default_qty),
    protein_per_100g: per100 == null ? null : round(per100),
  };
}

const byPosition = (a, b) => a.position - b.position;

const shapeSet = (s) => ({ kind: s.kind, load_kg: s.load_kg == null ? null : Number(s.load_kg), reps: s.reps, note: s.note || undefined });

export function shapePlan(templates) {
  return templates.map((t) => ({
    id: t.id, name: t.name, preferred_day: t.preferred_day,
    exercises: [...t.workout_template_exercises].sort(byPosition).map((te) => ({
      exercise_id: te.exercise_id,
      name: te.training_exercises?.name,
      muscle_group: te.training_exercises?.muscle_group,
      load_mode: te.training_exercises?.load_mode,
      target_sets: te.target_sets,
      rest_seconds: te.rest_seconds,
      notes: te.notes || te.training_exercises?.notes || undefined,
    })),
  }));
}

export function shapeSessions(sessions) {
  return sessions.map((s) => ({
    id: s.id, performed_on: s.performed_on, workout: s.template_name, status: s.status,
    partial: s.partial, notes: s.notes || undefined,
    exercises: [...s.workout_session_exercises].sort(byPosition).map((se) => {
      const sets = [...se.workout_sets].sort(byPosition);
      return {
        exercise_id: se.exercise_id, name: se.exercise_name, muscle_group: se.muscle_group,
        load_mode: se.load_mode, weight_basis: se.weight_basis, reps_basis: se.reps_basis,
        status: se.status, target_sets: se.target_sets,
        volume_kg: workoutVolume(sets, se.load_mode),
        sets: sets.map(shapeSet),
      };
    }),
  }));
}

export function shapeProgress(rows) {
  return progressPoints(rows).map((p) => ({
    date: p.date, workout: p.template, load_mode: p.mode, volume_kg: p.volume,
    heaviest: p.heaviest && shapeSet(p.heaviest),
    sets: p.sets.map(shapeSet),
  }));
}
