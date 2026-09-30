import test from "node:test";
import assert from "node:assert/strict";
import { parseSet, workoutVolume, progressPoints, bestAtLoad } from "./workout.js";

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
