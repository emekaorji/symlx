import { z } from 'zod';

import * as log from '../ui/logger';

const binNameSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'invalid bin name');

const binTargetSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^\.{1,2}\//, 'bin target must be a relative path like ./cli.js');

const binRecordSchema = z.record(binNameSchema, binTargetSchema);

const binEntrySchema = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?=\.{1,2}\/.+$/,
    'expected <name=./relative/path>',
  );

const binEntriesToRecordSchema = z
  .array(binEntrySchema)
  .optional()
  .default([])
  .transform(
    (entries): Record<string, string> =>
      Object.fromEntries(
        entries.map((entry) => {
          const [name, target] = entry.split('=', 2);
          return [name, target];
        }),
      ),
  );

// -------------------------------------------

const packageJSONOptionsSchema = z.object({
  bin: binRecordSchema.optional().catch(undefined),
});

// -------------------------------------------

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
  bin: binRecordSchema.optional(),
});

// -------------------------------------------

const serveInlineOptionsSchema = configFileOptionsSchema
  .pick({ binDir: true, collision: true, nonInteractive: true })
  .extend({
    bin: binEntriesToRecordSchema,
  });

// TODO: Remove types from here later
export type PackageJSONOptions = z.infer<typeof packageJSONOptionsSchema>;
export type ConfigFileOptions = z.infer<typeof configFileOptionsSchema>;
export type Options = Required<ConfigFileOptions>;

export {
  packageJSONOptionsSchema,
  configFileOptionsSchema,
  serveInlineOptionsSchema,
};
