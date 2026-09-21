import assert from "node:assert/strict";
import test from "node:test";
import { acquireRequestLock, captureFoodEstimateRequest, capturePhotoRequest, captureRequestRevision, clearRequestLock, releaseRequestLock } from "./request.js";

test("captureRequestRevision marks an earlier request as stale", () => {
  const revision = { current: 0 };
  const first = captureRequestRevision(revision);

  assert.equal(first(), true);
  const second = captureRequestRevision(revision);
  assert.equal(first(), false);
  assert.equal(second(), true);
});

test("capturePhotoRequest keeps its starting file and trimmed guidance", () => {
  const revision = { current: 0 };
  const file = { name: "meal.jpg" };
  const request = capturePhotoRequest(revision, file, "  150 גרם בשר  ");

  assert.equal(request.file, file);
  assert.equal(request.guidance, "150 גרם בשר");
  assert.equal(request.isCurrent(), true);

  captureRequestRevision(revision);
  assert.equal(request.isCurrent(), false);
});

test("captures every nutrition-relevant manual field", () => {
  assert.deepEqual(
    captureFoodEstimateRequest(7, "חזה עוף", "100 גרם", "2", "200"),
    {
      revision: 7,
      foodName: "חזה עוף",
      unit: "100 גרם",
      quantity: 2,
      totalGrams: 200,
    },
  );
});

test("keeps saved-food estimate callers compatible", () => {
  assert.deepEqual(
    captureFoodEstimateRequest(3, "יוגורט", "גביע"),
    {
      revision: 3,
      foodName: "יוגורט",
      unit: "גביע",
      quantity: 1,
      totalGrams: null,
    },
  );
});

test("captureFoodEstimateRequest snapshots all nutrition fields and becomes stale after an edit", () => {
  const revision = { current: 0 };
  const request = captureFoodEstimateRequest(revision, "  יוגורט חלבון  ", "  יחידה  ", "2", "200");

  assert.equal(request.foodName, "יוגורט חלבון");
  assert.equal(request.unit, "יחידה");
  assert.equal(request.quantity, 2);
  assert.equal(request.totalGrams, 200);
  assert.equal(request.isCurrent(), true);

  captureRequestRevision(revision);
  assert.equal(request.isCurrent(), false);
});

test("every nutrition-field edit invalidates a captured estimate", () => {
  for (const changedField of ["foodName", "unit", "quantity", "totalGrams"]) {
    const revision = { current: 0 };
    const request = captureFoodEstimateRequest(revision, "יוגורט", "גביע", 1, null);

    captureRequestRevision(revision);
    assert.equal(request.isCurrent(), false, changedField);
  }
});

test("request lock blocks overlap and an old release preserves a new request", () => {
  const lock = { current: null };
  const first = acquireRequestLock(lock);

  assert.ok(first);
  assert.equal(acquireRequestLock(lock), null);

  clearRequestLock(lock);
  const second = acquireRequestLock(lock);
  assert.ok(second);

  releaseRequestLock(lock, first);
  assert.equal(lock.current, second);

  releaseRequestLock(lock, second);
  assert.equal(lock.current, null);
});
