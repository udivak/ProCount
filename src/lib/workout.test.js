import test from "node:test";
import assert from "node:assert/strict";
import { parseSet, workoutVolume, progressPoints, bestAtLoad, groupExercisesByMuscle, targetSetProgress, targetReps, workoutLoadLabel } from "./workout.js";

test("set instructions distinguish fixed reps, ranges, bodyweight and missing loads", () => {
  assert.deepEqual([
    { load_kg: 87.5, reps_min: 8, reps_max: 8 },
    { load_kg: 85, reps_min: 9, reps_max: 9 },
    { load_kg: 80, reps_min: 8, reps_max: 8 },
  ].map((target) => [workoutLoadLabel(target.load_kg, "external"), targetReps(target)]), [["87.5", "8"], ["85", "9"], ["80", "8"]]);
  assert.equal(targetReps({ reps_min: 8, reps_max: 12 }), "8–12");
  assert.equal(targetReps(null), "—");
  assert.equal(workoutLoadLabel(null, "external"), "לא הוגדר");
  assert.equal(workoutLoadLabel(null, "assisted"), "לא הוגדר");
  assert.equal(workoutLoadLabel(null, "bodyweight"), "משקל גוף");
  assert.equal(workoutLoadLabel(0, "external"), "0");
});

test("keeps decimal loads and separate set reps; excludes warmups", () => {
  const sets = [
    { kind: "work", load_kg: 20, reps: 10 },
    { kind: "work", load_kg: 17.5, reps: 9 },
    { kind: "work", load_kg: 15, reps: 6 },
    { kind: "warmup", load_kg: 10, reps: 10 },
  ];
  assert.deepEqual(parseSet("23.75", "4", "external"), { load_kg: 23.75, reps: 4 });
  assert.deepEqual(parseSet("", "8", "bodyweight"), { load_kg: null, reps: 8 });
  assert.equal(parseSet("", "8", "external"), null);
  assert.equal(parseSet("20", "", "external"), null);
  assert.equal(workoutVolume(sets, "external"), 447.5);
  assert.equal(workoutVolume(sets, "assisted"), null);
  const points = progressPoints(sets.map((set, index) => ({ ...set, session_id: "one", session_exercise_id: "entry", performed_on: "2026-09-30", template_name: "A", load_mode: "external", set_id: String(index) })));
  assert.equal(points[0].heaviest.load_kg, 20);
  assert.equal(points[0].heaviest.reps, 10);
  assert.equal(points[0].volume, 447.5);
  assert.equal(bestAtLoad(points, 20).reps, 10);
  assert.equal(bestAtLoad(points, 17.5).reps, 9);
});

test("muscle groups preserve first appearance, exercise order and item identity", () => {
  const items = [
    { id: "back-1", muscle_group: " גב " },
    { id: "chest", muscle_group: "חזה" },
    { id: "back-2", muscle_group: "גב" },
    { id: "missing", muscle_group: " " },
    { id: "archived" },
  ];
  const groups = groupExercisesByMuscle(items);
  assert.deepEqual(groups.map((group) => group.name), ["גב", "חזה", "ללא קבוצת שרירים"]);
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.id)), [["back-1", "back-2"], ["chest"], ["missing", "archived"]]);
  assert.equal(groups[0].items[0], items[0]);
  assert.deepEqual(groupExercisesByMuscle([]), []);
  assert.deepEqual(groupExercisesByMuscle([{ id: "template-item" }], () => "כתפיים").map((group) => group.name), ["כתפיים"]);
});

test("target progress counts saved target positions once, excluding extras and skips", () => {
  const exercises = [
    { id: "one", target_sets: [{}, {}], status: "pending" },
    { id: "skip", target_sets: [{}, {}], status: "skipped" },
    { id: "empty", target_sets: [], status: "pending" },
  ];
  const sets = [
    { session_exercise_id: "one", position: 0 },
    { session_exercise_id: "one", position: 0 },
    { session_exercise_id: "one", position: 2 },
    { session_exercise_id: "skip", position: 0 },
    { session_exercise_id: "skip", position: 1 },
    { session_exercise_id: "empty", position: 0 },
    { session_exercise_id: "unrelated", position: 0 },
  ];
  assert.deepEqual(targetSetProgress(exercises, sets), { saved: 2, total: 5, skipped: 1 });
  assert.deepEqual(targetSetProgress(exercises.map((item) => ({ ...item, status: "pending" })), [...sets, { session_exercise_id: "one", position: 1 }]), { saved: 5, total: 5, skipped: 0 });
  assert.deepEqual(targetSetProgress(exercises, []), { saved: 0, total: 5, skipped: 1 });
  assert.deepEqual(targetSetProgress([], sets), { saved: 0, total: 0, skipped: 0 });
});
