import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  startServeSession,
  type ServeRuntimeDependencies,
} from '../src/lib/serve-runtime';

import type { Options } from '../src/lib/schema';
import type { CollisionPolicy, SessionRecord } from '../src/lib/types';

const defaultLinkRecord = {
  name: 'my-cli',
  linkPath: '/tmp/symlx/bin/my-cli',
  target: '/tmp/project/dist/cli.js',
};

function createOptions(overrides: Partial<Options> = {}): Options {
  return {
    collision: 'prompt',
    nonInteractive: false,
    binDir: '/tmp/symlx/bin',
    bin: {
      'my-cli': '/tmp/project/dist/cli.js',
    },
    binResolutionStrategy: 'replace',
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<ServeRuntimeDependencies> = {},
): ServeRuntimeDependencies {
  return {
    resolveWorkingDirectory: () => '/tmp/project',
    resolveHomeDirectory: () => '/tmp/home',
    resolveProcessId: () => 4242,
    resolveTimestamp: () => '2026-01-01T00:00:00.000Z',
    isInteractiveSession: () => true,
    cleanupStaleSessions: () => undefined,
    ensureDirectories: () => undefined,
    assertValidBinTargets: () => undefined,
    createLinks: async () => ({
      created: [defaultLinkRecord],
      skipped: [],
    }),
    createSessionFilePath: () => '/tmp/home/.symlx/sessions/session.json',
    persistSession: () => undefined,
    registerLifecycleCleanup: () => undefined,
    cleanupSession: () => undefined,
    waitUntilStopped: async () => undefined,
    ...overrides,
  };
}

test('startServeSession falls back to skip in non-interactive prompt mode', async () => {
  let selectedPolicy: CollisionPolicy | undefined;
  const dependencies = createDependencies({
    isInteractiveSession: () => false,
    createLinks: async (params) => {
      selectedPolicy = params.policy;
      return {
        created: [defaultLinkRecord],
        skipped: [],
      };
    },
  });

  const session = await startServeSession({
    options: createOptions({ nonInteractive: true }),
    promptCollisionResolver: async () => 'overwrite',
    dependencies,
  });

  assert.equal(selectedPolicy, 'skip');
  assert.equal(session.collision.requested, 'prompt');
  assert.equal(session.collision.effective, 'skip');
  assert.match(session.collision.warning ?? '', /falling back to skip/);
});

test('startServeSession throws targeted error when every link is skipped', async () => {
  const dependencies = createDependencies({
    createLinks: async () => ({
      created: [],
      skipped: [
        {
          name: 'my-cli',
          linkPath: '/tmp/symlx/bin/my-cli',
          reason: 'already exists as a file',
        },
      ],
    }),
  });

  await assert.rejects(
    () =>
      startServeSession({
        options: createOptions({ collision: 'overwrite' }),
        dependencies,
      }),
    /no links were created because all candidate commands were skipped\./,
  );
});

test('startServeSession persists session and registers lifecycle cleanup', async () => {
  let persistedPath: string | undefined;
  let persistedRecord: SessionRecord | undefined;
  let lifecycleCleanupHandler: (() => void) | undefined;
  const cleanupCalls: Array<{
    sessionPath: string;
    links: SessionRecord['links'];
  }> = [];
  let waited = false;

  const dependencies = createDependencies({
    persistSession: (sessionPath, record) => {
      persistedPath = sessionPath;
      persistedRecord = record;
    },
    registerLifecycleCleanup: (cleanup) => {
      lifecycleCleanupHandler = cleanup;
    },
    cleanupSession: (sessionPath, links) => {
      cleanupCalls.push({ sessionPath, links });
    },
    waitUntilStopped: async () => {
      waited = true;
    },
  });

  const session = await startServeSession({
    options: createOptions({ collision: 'overwrite' }),
    dependencies,
  });

  assert.equal(persistedPath, '/tmp/home/.symlx/sessions/session.json');
  assert.equal(persistedRecord?.pid, 4242);
  assert.equal(persistedRecord?.cwd, '/tmp/project');
  assert.equal(persistedRecord?.createdAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(persistedRecord?.links, [defaultLinkRecord]);
  assert.equal(typeof lifecycleCleanupHandler, 'function');

  await session.waitUntilStopped();
  assert.equal(waited, true);

  lifecycleCleanupHandler?.();
  assert.deepEqual(cleanupCalls, [
    {
      sessionPath: '/tmp/home/.symlx/sessions/session.json',
      links: [defaultLinkRecord],
    },
  ]);
});
