import { z } from 'zod';

const collisionPolicySchema = z.enum(['prompt', 'skip', 'fail', 'overwrite']);

const serveOptionsSchema = z.object({
  binDir: z.string().trim().min(1).optional(),
  collision: collisionPolicySchema,
  nonInteractive: z.boolean(),
});

function formatIssues(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join('.') : 'value';
      return `${pathLabel}: ${issue.message}`;
    })
    .join('; ');
  return details || 'invalid input';
}

export function validate<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  label = 'input',
): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(`invalid ${label}: ${formatIssues(result.error)}`);
  }
  return result.data;
}

export { collisionPolicySchema, serveOptionsSchema };
