import test from "node:test";
import assert from "node:assert/strict";
import { dateRange, shapeNutrition, shapeProfile, shapeSessions, todayIn } from "./shape.js";

test("swimming reads expose swim metrics and preserve unknown distance without strength volume", () => {
  const [session] = shapeSessions([{ id: "swim", kind: "swimming", workout_swim_details: { duration_seconds: 2100, distance_m: 1250, stroke: "freestyle", pool_length_m: 25, length_count: 50 }, workout_session_exercises: [] }]);
  assert.equal(session.kind, "swimming");
  assert.equal(session.swim.distance_m, 1250);
  assert.equal(session.swim.pace_per_100m, "2:48");
  assert.deepEqual(session.exercises, []);
  const [unknown] = shapeSessions([{ kind: "swimming", workout_swim_details: { duration_seconds: 900, distance_m: null }, workout_session_exercises: [] }]);
  assert.equal(unknown.swim.pace_per_100m, null);
});

test("dateRange is inclusive and rejects bad input", () => {
  assert.deepEqual(dateRange("2026-02-27", "2026-03-01", 31), ["2026-02-27", "2026-02-28", "2026-03-01"]);
  assert.throws(() => dateRange("2026-03-02", "2026-03-01", 31), /on or before/);
  assert.throws(() => dateRange("2026-01-01", "2026-12-31", 92), /at most 92/);
  assert.throws(() => dateRange("2026-02-30", "2026-03-01", 31), /Invalid date/);
  assert.throws(() => dateRange("21/10/2026", "2026-10-21", 31), /Invalid date/);
});

test("todayIn uses Israel time, not UTC", () => {
  assert.equal(todayIn(new Date("2026-10-20T22:30:00Z")), "2026-10-21");
});

test("shapeProfile tolerates a missing profile row", () => {
  const p = shapeProfile(null, "2026-10-21");
  assert.equal(p.protein_goal_g, 160);
  assert.equal(p.water_goal_ml, 3000);
  assert.equal(p.workout_goal_weekly, 3);
});

test("shapeNutrition: water is not protein, empty days are zero, streak ends at `to`", () => {
  const profile = shapeProfile({ protein_goal_g: 100 }, "2026-10-21");
  const entries = [
    { eaten_on: "2026-10-19", protein_g: 120, calories: 1800, meal_type: "lunch", source: "saved", name: "עוף" },
    { eaten_on: "2026-10-21", protein_g: 100, calories: 1500, meal_type: "dinner", source: "manual", name: "ביצים" },
    { eaten_on: "2026-10-21", protein_g: 0, calories: 0, entry_kind: "water", water_ml: 500 },
  ];
  const out = shapeNutrition(entries, profile, ["2026-10-19", "2026-10-20", "2026-10-21"], true);
  assert.deepEqual(out.days.map((d) => d.protein_g), [120, 0, 100]);
  assert.equal(out.days[2].water_ml, 500);
  assert.equal(out.days[2].food_entries, 1);
  assert.equal(out.days[1].meals.length, 0);
  assert.equal(out.days[2].meals[0].meal, "dinner");
  assert.equal(out.summary.days_protein_goal_met, 2);
  assert.equal(out.summary.protein_streak_ending_to, 1);
  assert.equal(out.summary.avg_calories_per_logged_day, 1650);
});

test("shapeSessions orders exercises and sets by position", () => {
  const [s] = shapeSessions([{
    id: "s", performed_on: "2026-10-20", template_name: "A", status: "completed", partial: false,
    workout_session_exercises: [
      { position: 1, exercise_name: "second", load_mode: "external", workout_sets: [] },
      { position: 0, exercise_name: "first", load_mode: "external", workout_sets: [
        { position: 1, kind: "work", load_kg: 20, reps: 8 },
        { position: 0, kind: "work", load_kg: 20, reps: 10 },
      ] },
    ],
  }]);
  assert.deepEqual(s.exercises.map((e) => e.name), ["first", "second"]);
  assert.deepEqual(s.exercises[0].sets.map((x) => x.reps), [10, 8]);
  assert.equal(s.exercises[0].volume_kg, 360);
});

test("workout readback preserves IDs, revisions and nullable loads for safe correction", () => {
  const [s] = shapeSessions([{ id: "session", revision: 4, template_id: "template", performed_on: "2026-10-24",
    workout_session_exercises: [{ id: "occurrence", exercise_id: "exercise", revision: 3, position: 0,
      load_mode: "bodyweight", workout_sets: [{ id: "set", revision: 2, position: 0, reps: 8, load_kg: null, kind: "work" }] }] }]);
  assert.equal(s.revision, 4);
  assert.equal(s.template_id, "template");
  assert.equal(s.exercises[0].id, "occurrence");
  assert.equal(s.exercises[0].revision, 3);
  assert.deepEqual(s.exercises[0].sets[0], { id: "set", revision: 2, position: 0, reps: 8, load_kg: null, kind: "work", note: undefined });
});
