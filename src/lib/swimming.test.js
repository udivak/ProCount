import test from "node:test";
import assert from "node:assert/strict";
import * as swim from "./swimming.js";

const draft = { minutes: "35", seconds: "0", distanceMode: "lengths", poolLength: "25", lengths: "50", distance: "", stroke: "freestyle" };

test("swim summary records actual distance and total duration without fake strength sets", () => {
  assert.deepEqual(swim.parseSwim(draft), { duration_seconds: 2100, distance_m: 1250, pool_length_m: 25, length_count: 50, stroke: "freestyle" });
  assert.equal(swim.swimPace(swim.parseSwim(draft)), "2:48");
  assert.equal(swim.swimPace({ duration_seconds: 1199, distance_m: 1000 }), "2:00");
});

test("manual distance ignores hidden lengths and absent distance is unknown", () => {
  assert.deepEqual(swim.parseSwim({ ...draft, distanceMode: "manual", distance: "800.5" }), { duration_seconds: 2100, distance_m: 800.5, pool_length_m: null, length_count: null, stroke: "freestyle" });
  const unknown = swim.parseSwim({ ...draft, distanceMode: "manual", distance: "" });
  assert.equal(unknown.distance_m, null);
  assert.equal(swim.swimPace(unknown), null);
});

test("invalid duration, distance, pool, count, mode or stroke never become a saved swim", () => {
  for (const patch of [{ minutes: "", seconds: "" }, { minutes: "-1" }, { seconds: "60" }, { seconds: "1.5" }, { minutes: "Infinity" }, { minutes: "1441" }, { lengths: "2.5" }, { lengths: "0" }, { poolLength: "0" }, { poolLength: "201" }, { distanceMode: "manual", distance: "0" }, { distanceMode: "manual", distance: "NaN" }, { distanceMode: "unknown" }, { stroke: "bad" }]) {
    assert.equal(swim.parseSwim({ ...draft, ...patch }), null, JSON.stringify(patch));
  }
});

test("progress excludes cancelled/strength sessions and reports missing-distance coverage", () => {
  assert.deepEqual(swim.swimSummary([
    { kind: "swimming", status: "completed", swim: { duration_seconds: 2100, distance_m: 1250 } },
    { kind: "swimming", status: "completed", swim: { duration_seconds: 900, distance_m: null } },
    { kind: "swimming", status: "cancelled", swim: { duration_seconds: 999, distance_m: 999 } },
    { kind: "strength", status: "completed" },
  ]), { count: 2, duration_seconds: 3000, distance_m: 1250, withDistance: 1 });
});
