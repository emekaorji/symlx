import assert from 'node:assert/strict';
import { test } from 'node:test';

import { serveInlineOptionsSchema } from '../src/lib/schema';

test('inline --bin accepts relative targets like dist/cli.js', () => {
  const result = serveInlineOptionsSchema.safeParse({
    bin: ['my-cli=dist/cli.js'],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.bin, { 'my-cli': 'dist/cli.js' });
  }
});

test('inline --bin rejects invalid command names', () => {
  const result = serveInlineOptionsSchema.safeParse({
    bin: ['my cli=dist/cli.js'],
  });

  assert.equal(result.success, false);
});

test('inline --bin rejects absolute paths', () => {
  const result = serveInlineOptionsSchema.safeParse({
    bin: ['my-cli=/tmp/cli.js'],
  });

  assert.equal(result.success, false);
});
