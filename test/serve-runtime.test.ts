import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveInternalCollisionOption } from '../src/lib/options';

test('resolveInternalCollisionOption keeps explicit non-prompt policies', () => {
  assert.equal(resolveInternalCollisionOption('skip', false), 'skip');
  assert.equal(resolveInternalCollisionOption('fail', false), 'fail');
  assert.equal(resolveInternalCollisionOption('overwrite', false), 'overwrite');
});

test('resolveInternalCollisionOption falls back to skip for non-interactive prompt mode', () => {
  assert.equal(resolveInternalCollisionOption('prompt', true), 'skip');
});
