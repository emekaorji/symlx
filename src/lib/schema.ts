import { z } from 'zod';

import * as log from '../ui/logger';

const configFileOptionsSchema = z.object({
  binDir: z
    .string()
    .regex(
      /(^|[\\/])\.[^\\/]+([\\/]|$)/,
      'binDir must include a dotted folder segment',
    )
    .optional(),
  collision: z
    .enum(['prompt', 'skip', 'fail', 'overwrite'])
    .optional()
    .catch(() => {
      log.warn('invalid "collision" value in config file; using default.');
      return undefined;
    }),
  nonInteractive: z
    .boolean()
    .optional()
    .catch(() => {
      log.warn('invalid "nonInteractive" value in config file; using default.');
      return undefined;
    }),
});

const collisionPolicySchema = z.enum(['prompt', 'skip', 'fail', 'overwrite']);

const serveInlineOptionsSchema = z.object({
  binDir: z.string().trim().min(1).optional(),
  collision: collisionPolicySchema,
  nonInteractive: z.boolean(),
});

// TODO: Remove types from here later
export type ConfigFileOptions = z.infer<typeof configFileOptionsSchema>;
export type Options = Required<ConfigFileOptions>;

export { configFileOptionsSchema, serveInlineOptionsSchema };
