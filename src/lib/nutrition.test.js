// Run: npm test   (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyTotals, remainingProtein, pct, streak, weekSeries } from "./nutrition.js";

test("dailyTotals sums one day, ignores others", () => {
  const e = [
    { eaten_on: "2026-06-18", protein_g: 30, calories: 200 },
    { eaten_on: "2026-06-18", protein_g: 20, calories: 100 },
    { eaten_on: "2026-06-17", protein_g: 99, calories: 999 },
  ];
  assert.deepEqual(dailyTotals(e, "2026-06-18"), { protein: 50, calories: 300, count: 2 });
});

test("dailyTotals on an empty day is zero", () => {
  assert.deepEqual(dailyTotals([], "2026-06-18"), { protein: 0, calories: 0, count: 0 });
});

test("remainingProtein never goes negative", () => {
  assert.equal(remainingProtein(40, 175), 135);
  assert.equal(remainingProtein(200, 175), 0);
});

test("pct caps at 1 and guards a zero goal", () => {
  assert.equal(pct(0, 175), 0);
  assert.equal(pct(350, 175), 1);
  assert.equal(pct(50, 0), 0);
});

test("streak: today below goal doesn't break a prior run", () => {
  const from = new Date("2026-06-18T12:00:00");
  const byDay = { "2026-06-18": 40, "2026-06-17": 160, "2026-06-16": 151, "2026-06-15": 150, "2026-06-14": 10 };
  assert.equal(streak(byDay, 150, from), 3);
});

test("streak: counts today when met, stops at first miss", () => {
  const from = new Date("2026-06-18T12:00:00");
  const byDay = { "2026-06-18": 180, "2026-06-17": 200, "2026-06-16": 100 };
  assert.equal(streak(byDay, 150, from), 2);
});

test("streak is zero with no goal", () => {
  assert.equal(streak({ "2026-06-18": 999 }, 0), 0);
});

test("weekSeries fills missing days with zero, in order", () => {
  const e = [{ eaten_on: "2026-06-17", protein_g: 50 }];
  assert.deepEqual(weekSeries(e, ["2026-06-16", "2026-06-17", "2026-06-18"]), [
    { date: "2026-06-16", protein: 0 },
    { date: "2026-06-17", protein: 50 },
    { date: "2026-06-18", protein: 0 },
  ]);
});
