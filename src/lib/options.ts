import z from 'zod';
import type { Options } from './schema';
import { loadConfigFileOptions } from './utils';
import { validateConfigFileOptions, validateInlineOptions } from './validate';

const defaultOptions: Options = {
  collision: 'prompt',
  nonInteractive: false,
  binDir: '.symlx',
};

// Function to aggregate all options from different sources in order or priority
export function resolveOptions<TSchema extends z.ZodTypeAny>(
  inlineOptionsSchema: TSchema,
  inlineOptions?: unknown,
): Options {
  // Validate the CLI inline options if available
  const validatedInlineOptions = validateInlineOptions(
    inlineOptionsSchema,
    inlineOptions,
  );

  // Load and validate the options from the config file,
  // silently overriding invalid non-critical values with defaults or inline based on order of priority
  const configFileOptions = loadConfigFileOptions();
  const validatedConfigFileOptions =
    validateConfigFileOptions(configFileOptions);

  // Default options first
  // -> Config file options override defaults
  // -> CLI inline options overrides config file options
  return {
    ...defaultOptions,
    ...(validatedConfigFileOptions ?? {}),
    ...(validatedInlineOptions ?? {}),
  };
}
