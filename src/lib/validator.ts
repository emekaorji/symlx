import { z } from 'zod';

import {
  configFileOptionsSchema,
  PackageJSONOptions,
  packageJSONOptionsSchema,
  type ConfigFileOptions,
  type Options,
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
  input: { bin: Record<string, string> } | undefined,
): PackageJSONOptions & { issues: string[] } {
  const result = packageJSONOptionsSchema.safeParse(input || {});
  if (!result.success) {
    return { bin: {}, issues: result.error.issues.map((i) => i.message) };
  }
  return { ...result.data, issues: [] };
}

export function validateConfigFileOptions(
  input: Options | undefined,
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
