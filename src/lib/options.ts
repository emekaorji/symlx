import z from 'zod';
import path from 'path';
import os from 'node:os';

import * as log from '../ui/logger';

import type { CollisionOption, Options } from './schema';
import { loadConfigFileOptions, loadPackageJSONOptions } from './utils';
import {
  validateConfigFileOptions,
  validateInlineOptions,
  validatePackageJSONOptions,
} from './validator';

const DEFAULT_OPTIONS: Options = {
  collision: 'prompt',
  nonInteractive: false,
  binDir: path.join(os.homedir(), '.symlx', 'bin'),
  bin: {},
  binResolutionStrategy: 'replace',
};

function hasBinEntries(
  bin: Record<string, string> | undefined,
): bin is Record<string, string> {
  return Boolean(bin && Object.keys(bin).length > 0);
}

function computeResolvedBin(
  inlineBin: Record<string, string> | undefined,
  configFileBin: Record<string, string> | undefined,
  packageJSONBin: Record<string, string> | undefined,
  binResolutionStrategy?: 'replace' | 'merge',
) {
  // Aggregates bin from all sources:
  // inline + config + package.json + default
  if (binResolutionStrategy === 'merge') {
    return {
      ...(packageJSONBin ?? {}),
      ...(configFileBin ?? {}),
      ...(inlineBin ?? {}),
    };
  }

  // Bin source precedence is value-aware:
  // inline (if non-empty) -> config (if non-empty) -> package.json (if non-empty) -> default.
  return hasBinEntries(inlineBin)
    ? inlineBin
    : hasBinEntries(configFileBin)
      ? configFileBin
      : hasBinEntries(packageJSONBin)
        ? packageJSONBin
        : DEFAULT_OPTIONS.bin;
}

function withCwdPrefixedBin(
  cwd: string,
  bin: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bin).map(([name, target]) => [
      name,
      path.resolve(cwd, target),
    ]),
  );
}

function isInteractiveSession() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

// Function to aggregate all options from different sources in order or priority
export function resolveOptions<TSchema extends z.ZodTypeAny>(
  cwd: string,
  inlineOptionsSchema: TSchema,
  inlineOptions?: unknown,
): Options {
  const packageJSONLoadResult = loadPackageJSONOptions(cwd);
  const validatedPackageJSONOptions = validatePackageJSONOptions(
    packageJSONLoadResult,
  );
  const packageJSONIssues = [
    ...packageJSONLoadResult.issues,
    ...validatedPackageJSONOptions.issues,
  ];

  const configFileLoadResult = loadConfigFileOptions(cwd);
  const validatedConfigFileOptions = validateConfigFileOptions(
    configFileLoadResult.options,
  );

  const validatedInlineOptions = validateInlineOptions(
    inlineOptionsSchema,
    inlineOptions,
  );
  const inlineBin = (validatedInlineOptions as { bin?: Record<string, string> })
    .bin;

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...(validatedPackageJSONOptions ?? {}),
    ...(validatedConfigFileOptions ?? {}),
    ...(validatedInlineOptions ?? {}),
  };

  const resolvedBin = computeResolvedBin(
    inlineBin,
    validatedConfigFileOptions.bin,
    validatedPackageJSONOptions.bin,
    mergedOptions.binResolutionStrategy,
  );

  const finalOptions = {
    ...mergedOptions,
    bin: withCwdPrefixedBin(cwd, resolvedBin),
  };

  if (Object.keys(finalOptions.bin).length > 0) {
    if (
      finalOptions.binResolutionStrategy === 'merge' &&
      packageJSONIssues.length > 0
    ) {
      log.warn(
        [
          'bin resolution strategy is merge, but could not resolve bin from package.json:',
          ...packageJSONIssues,
        ].join('\n'),
      );
    }
    return finalOptions;
  }

  // only throw package.json error if no bin was resolved
  const primaryIssue = packageJSONIssues[0];
  if (primaryIssue) {
    throw new Error(primaryIssue);
  }

  throw new Error(
    [
      'no bin entries found.',
      'add at least one command in one of these places:',
      '1) package.json -> "bin": { "my-cli": "./cli.js" }',
      '2) symlx.config.json -> "bin": { "my-cli": "./cli.js" }',
      '3) inline CLI -> symlx serve --bin my-cli=./cli.js',
    ].join('\n'),
  );
}

export function resolveInternalCollisionOption(
  collisionOptions: Options['collision'],
  nonInteractiveOptions: Options['nonInteractive'],
): CollisionOption {
  if (collisionOptions !== 'prompt') {
    return collisionOptions;
  }

  if (nonInteractiveOptions || !isInteractiveSession()) {
    return 'skip';
  }

  return 'prompt';
}
