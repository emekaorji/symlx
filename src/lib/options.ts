import z from 'zod';
import path from 'path';
import os from 'node:os';

import type { Options } from './schema';
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

// Function to aggregate all options from different sources in order or priority
export function resolveOptions<TSchema extends z.ZodTypeAny>(
  cwd: string,
  inlineOptionsSchema: TSchema,
  inlineOptions?: unknown,
): Options {
  // Load the bin from package.json
  const packageJSONOptions = loadPackageJSONOptions(cwd);
  const validatedPackageJSONOptions =
    validatePackageJSONOptions(packageJSONOptions);
  const issues = [
    ...packageJSONOptions.issues,
    ...validatedPackageJSONOptions.issues,
  ];

  // Load and validate the options from the config file,
  // silently overriding invalid non-critical values with defaults or inline based on order of priority
  const configFileOptions = loadConfigFileOptions();
  const validatedConfigFileOptions =
    validateConfigFileOptions(configFileOptions);

  // Validate the CLI inline options if available
  const validatedInlineOptions = validateInlineOptions(
    inlineOptionsSchema,
    inlineOptions,
  );
  const inlineBin = (validatedInlineOptions as { bin?: Record<string, string> })
    .bin;

  // Default options first
  // -> package.json options override defaults
  // -> config file options override package.json
  // -> CLI inline options overrides config file options
  const finalOptions = {
    ...DEFAULT_OPTIONS,
    ...(validatedPackageJSONOptions ?? {}),
    ...(validatedConfigFileOptions ?? {}),
    ...(validatedInlineOptions ?? {}),
  };

  const resolvedBin = computeResolvedBin(
    inlineBin,
    validatedConfigFileOptions.bin,
    validatedPackageJSONOptions.bin,
    finalOptions.binResolutionStrategy,
  );

  const finalfinalOptionsIPromise = {
    ...finalOptions,
    bin: withCwdPrefixedBin(cwd, resolvedBin),
  };

  if (!Object.entries(finalfinalOptionsIPromise.bin).length) {
    if (issues.length) throw new Error(issues[0]);

    throw new Error(
      [
        'no bin entries found. add at least one bin in any of these places:',
        '1) package.json -> "bin": { "my-cli": "./cli.js" }',
        '2) symlx.config.json -> "bin": { "my-cli": "./cli.js" }',
        '3) inline CLI -> symlx serve --bin my-cli=./cli.js',
        '4) if package.json "bin" is a string, set a valid package.json "name" (used to infer the bin name).',
      ].join('\n'),
    );
  }

  return finalfinalOptionsIPromise;
}
