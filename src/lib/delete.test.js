import assert from "node:assert/strict";
import test from "node:test";
import { foodUndoTarget, reconcileDeletedRow } from "./delete.js";

test("reconcileDeletedRow keeps a confirmed delete removed", async () => {
  const target = { id: "entry-2", name: "יוגורט" };
  let rows = [{ id: "entry-1" }, target, { id: "entry-3" }];
  let probes = 0;
  const result = await reconcileDeletedRow({
    snapshot: target,
    remove: (id) => { rows = rows.filter((row) => row.id !== id); },
    restore: (row) => { rows = [...rows, row]; },
    deleteRemote: async (id) => ({ data: id === target.id ? target : null, error: null }),
    findById: async () => { probes += 1; return { data: target, error: null }; },
  });

  assert.deepEqual(result, { data: target, error: null });
  assert.deepEqual(rows, [{ id: "entry-1" }, { id: "entry-3" }]);
  assert.equal(probes, 0);
});

test("reconcileDeletedRow restores only a target confirmed to still exist", async () => {
  const target = { id: "entry-2", name: "יוגורט" };
  const failed = new Error("denied");
  let rows = [{ id: "entry-1" }, target, { id: "entry-3" }];
  const result = await reconcileDeletedRow({
    snapshot: target,
    remove: (id) => { rows = rows.filter((row) => row.id !== id); },
    restore: (row) => { if (!rows.some((current) => current.id === row.id)) rows = [...rows, row]; },
    deleteRemote: async () => ({ data: null, error: failed }),
    findById: async (id) => ({ data: id === target.id ? target : null, error: null }),
  });

  assert.equal(result.data, null);
  assert.equal(result.error, failed);
  assert.deepEqual(rows, [{ id: "entry-1" }, { id: "entry-3" }, target]);
});

test("reconcileDeletedRow checks a no-row delete against the same entry", async () => {
  const target = { id: "entry-2", name: "יוגורט" };
  let rows = [{ id: "entry-1" }, target];
  let lookupId = null;
  const result = await reconcileDeletedRow({
    snapshot: target,
    remove: (id) => { rows = rows.filter((row) => row.id !== id); },
    restore: (row) => { if (!rows.some((current) => current.id === row.id)) rows = [...rows, row]; },
    deleteRemote: async () => ({ data: null, error: null }),
    findById: async (id) => { lookupId = id; return { data: target, error: null }; },
  });

  assert.equal(result.data, null);
  assert.equal(result.error.message, "delete_unconfirmed");
  assert.equal(lookupId, target.id);
  assert.deepEqual(rows, [{ id: "entry-1" }, target]);
});

test("reconcileDeletedRow keeps an uncertain delete removed when lookup finds no row", async () => {
  const target = { id: "entry-2", name: "יוגורט" };
  let rows = [{ id: "entry-1" }, target];
  let restores = 0;
  const result = await reconcileDeletedRow({
    snapshot: target,
    remove: (id) => { rows = rows.filter((row) => row.id !== id); },
    restore: () => { restores += 1; },
    deleteRemote: async () => ({ data: null, error: new Error("network lost") }),
    findById: async (id) => ({ data: id === target.id ? null : target, error: null }),
  });

  assert.deepEqual(result, { data: target, error: null });
  assert.deepEqual(rows, [{ id: "entry-1" }]);
  assert.equal(restores, 0);
});

test("foodUndoTarget uses a new entry ID and ignores a catalog-only retry", () => {
  assert.deepEqual(foodUndoTarget({
    entry: { data: { id: "entry-1" }, error: null },
    food: { data: { id: "catalog-1" }, error: null },
  }), { id: "entry-1" });
  assert.deepEqual(foodUndoTarget({ data: { id: "quick-entry" }, error: null }), { id: "quick-entry" });
  assert.equal(foodUndoTarget({ entry: { data: null, error: null, skipped: true } }), null);
});
