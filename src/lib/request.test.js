import assert from "node:assert/strict";
import test from "node:test";
import { acquireRequestLock, capturePhotoRequest, captureRequestRevision, clearRequestLock, releaseRequestLock } from "./request.js";

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
