import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftDate, dayLabel, greeting, lastNWeeks, weekRangeLabel } from "./date.js";

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

test("lastNWeeks returns n weeks of 7 dates, oldest→newest, ending today", () => {
  const weeks = lastNWeeks(4, new Date("2026-06-21T12:00:00"));
  assert.equal(weeks.length, 4);
  for (const w of weeks) assert.equal(w.length, 7);
  assert.equal(weeks[0][0], "2026-05-25"); // 28 days back
  assert.equal(weeks[3][6], "2026-06-21"); // ends today
  // contiguous across bucket boundaries
  assert.equal(weeks[0][6], "2026-05-31");
  assert.equal(weeks[1][0], "2026-06-01");
});

test("weekRangeLabel formats a bucket's start/end, collapsing same month", () => {
  assert.equal(weekRangeLabel(["2026-06-01", "2026-06-02", "2026-06-07"]), "1–7.6");
  assert.equal(weekRangeLabel(["2026-05-25", "2026-05-31", "2026-06-01"]), "25.5–1.6");
  assert.equal(weekRangeLabel([]), "");
});

test("greeting picks the right part of day and appends the name", () => {
  assert.equal(greeting("X", new Date("2026-06-21T07:00:00")), "בוקר טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T13:00:00")), "צהריים טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T18:00:00")), "ערב טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T23:00:00")), "לילה טוב, X");
  assert.equal(greeting("X", new Date("2026-06-21T03:00:00")), "לילה טוב, X");
  assert.equal(greeting("", new Date("2026-06-21T07:00:00")), "בוקר טוב"); // no name → no comma
});
