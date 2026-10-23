import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshGuard } from './refresh.js';
test('background reads cannot overwrite a write, even after it finishes', async () => {
  const guard = createRefreshGuard();
  const before = guard.capture();
  let finish;
  const write = guard.mutate(() => new Promise(resolve => { finish = resolve; }));
  const during = guard.capture();
  assert.equal(before(), false); assert.equal(during(), false);
  finish(); await write;
  assert.equal(during(), false); assert.equal(guard.capture()(), true);
});
test('only latest refresh applies and failed writes release the guard', async () => {
  const guard = createRefreshGuard(), first = guard.capture(), second = guard.capture();
  assert.equal(first(), false); assert.equal(second(), true);
  await assert.rejects(guard.mutate(() => { throw Error('failure'); }));
  assert.equal(second(), false); assert.equal(guard.capture()(), true);
});
