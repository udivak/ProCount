import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftDate, dayLabel, greeting } from "./date.js";

test("shiftDate rolls over month and year boundaries", () => {
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2026-06-21", 1), "2026-06-22");
  assert.equal(shiftDate("2024-02-28", 1), "2024-02-29"); // leap year
});

test("dayLabel names today and yesterday, else formats the date", () => {
  const today = "2026-06-21";
  assert.equal(dayLabel(today, today), "היום");
  assert.equal(dayLabel("2026-06-20", today), "אתמול");
  assert.match(dayLabel("2026-06-10", today), /יוני/); // full Hebrew date
});

test("greeting picks the right part of day and appends the name", () => {
  assert.equal(greeting("X", new Date("2026-06-21T07:00:00")), "בוקר טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T13:00:00")), "צהריים טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T18:00:00")), "ערב טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T23:00:00")), "לילה טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T03:00:00")), "לילה טוב, X");
  assert.equal(greeting("", new Date("2026-06-21T07:00:00")), "בוקר טוב"); // no name → no comma
});
