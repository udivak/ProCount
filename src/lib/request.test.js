import assert from "node:assert/strict";
import test from "node:test";
import { captureRequestRevision } from "./request.js";

test("captureRequestRevision marks an earlier request as stale", () => {
  const revision = { current: 0 };
  const first = captureRequestRevision(revision);

  assert.equal(first(), true);
  const second = captureRequestRevision(revision);
  assert.equal(first(), false);
  assert.equal(second(), true);
});
