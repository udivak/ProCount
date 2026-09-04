import assert from "node:assert/strict";
import test from "node:test";
import { withSubmissionLock } from "./submission.js";

test("withSubmissionLock skips overlap and releases after failure", async () => {
  const lock = { current: false };
  let resolveFirst;
  let calls = 0;
  const first = withSubmissionLock(lock, async () => {
    calls += 1;
    await new Promise((resolve) => { resolveFirst = resolve; });
    return "saved";
  });

  assert.equal(await withSubmissionLock(lock, async () => { calls += 1; }), undefined);
  assert.equal(calls, 1);
  resolveFirst();
  assert.equal(await first, "saved");
  assert.equal(lock.current, false);

  await assert.rejects(() => withSubmissionLock(lock, async () => {
    throw new Error("offline");
  }), /offline/);
  assert.equal(lock.current, false);
});
