import { z } from 'zod';

import {
  configFileOptionsSchema,
  PackageJSONOptions,
  packageJSONOptionsSchema,
  type ConfigFileOptions,
} from './schema';

function formatIssues(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join('.') : 'value';
      return `${pathLabel}: ${issue.message}`;
    })
    .join('; ');
  return details || 'invalid input';
}

export function validatePackageJSONOptions(
  input: unknown,
): PackageJSONOptions & { issues: string[] } {
  const result = packageJSONOptionsSchema.safeParse(input || {});
  if (!result.success) {
    return { bin: {}, issues: result.error.issues.map((i) => i.message) };
  }
  return { ...result.data, issues: [] };
}

// it's better ux/dx to throw if there's an error in the config file
// provided it's available than falling back to defaults and leaving the user guessing
export function validateConfigFileOptions(
  input: unknown,
  label = 'input',
): ConfigFileOptions {
  const result = configFileOptionsSchema.safeParse(input || {});
  if (!result.success) {
    throw new Error(`invalid ${label}: ${formatIssues(result.error)}`);
  }
  return result.data;
}

export function validateInlineOptions<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  label = 'input',
): z.infer<TSchema> {
  const result = schema.safeParse(input || {});
  if (!result.success) {
    throw new Error(`invalid ${label}: ${formatIssues(result.error)}`);
  }
  return result.data;
}
