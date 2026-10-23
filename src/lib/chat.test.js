import test from "node:test";
import assert from "node:assert/strict";
import {
  chatTotals,
  isChatRequestCurrent,
  prepareChatRows,
  sameChatContext,
  saveChatRows,
  validateChatItems,
} from "./chat.js";
import { insertOrFind } from "./write.js";
const bounds = { oldest: "2026-09-19", today: "2026-10-23" };
const food = {
  draftKey: "a",
  kind: "food",
  date: "2026-10-23",
  mealType: "dinner",
  name: "כריך",
  quantityText: "שני כריכים",
  protein_g: 20,
  calories: 400,
  grams: null,
  water_ml: null,
  confidence: "medium",
  assumptions: ["אומדן"],
};
const water = {
  ...food,
  draftKey: "b",
  kind: "water",
  date: "2026-10-22",
  name: "מים",
  quantityText: "ליטר נוסף",
  protein_g: 0,
  calories: 0,
  water_ml: 1000,
};
test("validates mixed dated totals; freezes rows without multiplying servings", () => {
  assert.ok(validateChatItems([food, water], bounds));
  const rows = prepareChatRows(
    [food, water],
    bounds,
    () => crypto.randomUUID(),
  );
  assert.equal(rows[0].protein_g, 20);
  assert.equal(rows[0].source, "ai");
  assert.equal(rows[1].source, "manual");
  assert.equal(rows[1].eaten_on, "2026-10-22");
  assert.equal(rows[0].grams, null);
  assert.ok(Object.isFrozen(rows[0]));
  assert.ok(Object.isFrozen(rows));
  assert.deepEqual(chatTotals([food, water])["2026-10-23"].dinner, {
    protein: 20,
    calories: 400,
    water: 0,
  });
});
test("rejects invalid dates, shapes, duplicate keys and unsafe numbers", () => {
  for (
    const patch of [
      { date: "2026-02-30" },
      { date: "2026-10-24" },
      { date: "2026-09-18" },
      { calories: -1 },
      { protein_g: Infinity },
      { grams: 0 },
      { water_ml: 100 },
      { id: "forged" },
      { name: "" },
      { kind: "workout" },
      { mealType: "none" },
    ]
  ) {
    assert.equal(
      validateChatItems([{ ...food, ...patch }], bounds),
      false,
      JSON.stringify(patch),
    );
  }
  assert.equal(validateChatItems([food, food], bounds), false);
  assert.equal(
    validateChatItems(
      Array.from({ length: 31 }, (_, i) => ({ ...food, draftKey: String(i) })),
      bounds,
    ),
    false,
  );
  assert.throws(() =>
    prepareChatRows([{ ...food, id: "injected" }], bounds, () => "")
  );
});
test("UUID retry recovers timeout after commit and never writes a duplicate", async () => {
  const rows = prepareChatRows([food], bounds, () => crypto.randomUUID());
  let stored = null, writes = 0;
  const add = (row) =>
    insertOrFind({
      row,
      findById: async () => ({ data: stored }),
      insert: async (row) => {
        stored = row;
        writes++;
        throw Error("timeout");
      },
    });
  const find = async () => ({ data: stored });
  const first = await saveChatRows(rows, add, find);
  const retry = await saveChatRows(rows, add, find);
  assert.equal(first.saved.length, 1);
  assert.equal(retry.saved.length, 1);
  assert.equal(writes, 1);
});
test("partial success stays saved, failed/uncertain are distinct, changed UUID payload is not success", async () => {
  const rows = prepareChatRows(
    [food, water],
    bounds,
    () => crypto.randomUUID(),
  );
  const result = await saveChatRows(
    rows,
    async (r) => r === rows[0] ? { data: r } : { error: Error("offline") },
    async () => ({ data: null }),
  );
  assert.equal(result.saved.length, 1);
  assert.equal(result.failed.length, 1);
  const unknown = await saveChatRows([rows[1]], async () => {
    throw Error("timeout");
  }, async () => ({ error: Error("offline") }));
  assert.equal(unknown.uncertain.length, 1);
  const conflict = await saveChatRows(
    [rows[0]],
    async (r) => ({ data: { ...r, calories: 999 } }),
    async () => ({ data: { ...rows[0], calories: 999 } }),
  );
  assert.equal(conflict.saved.length, 0);
  assert.equal(conflict.uncertain.length, 1);
});
test("context is order independent, catches other devices and ignores only this attempt IDs", () => {
  const rows = prepareChatRows(
    [food, water],
    bounds,
    () => crypto.randomUUID(),
  );
  assert.ok(sameChatContext(rows, [...rows].reverse()));
  assert.ok(!sameChatContext(rows, [{ ...rows[0], water_ml: 500 }, rows[1]]));
  assert.ok(!sameChatContext([], rows));
  assert.ok(sameChatContext([], rows, rows.map((r) => r.id)));
  assert.ok(
    !sameChatContext(
      [],
      [...rows, { ...rows[0], id: "other" }],
      rows.map((r) => r.id),
    ),
  );
});
test("late responses cannot cross an edit, close, new request or midnight", () => {
  const revision = { current: 1 };
  const valid = () => revision.current === 1;
  assert.ok(isChatRequestCurrent(valid, "2026-10-23", "2026-10-23"));
  revision.current++;
  assert.ok(!isChatRequestCurrent(valid, "2026-10-23", "2026-10-23"));
  assert.ok(!isChatRequestCurrent(() => true, "2026-10-23", "2026-10-24"));
});
