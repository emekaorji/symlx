import { z } from 'zod';

import * as log from '../ui/logger';

const binNameSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'invalid bin name');

const binTargetSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^(?!\/)(?![A-Za-z]:[\\/])(?!(?:\\\\|\/\/)).+/,
    'bin target must be a relative path like ./cli.js',
  );

const binRecordSchema = z.record(binNameSchema, binTargetSchema);

const binEntrySchema = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?=(?!\/)(?![A-Za-z]:[\\/])(?!(?:\\\\|\/\/)).+$/,
    'expected <name=relative/path>',
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
// package.json Schema: Just bin for now
// -------------------------------------------

const packageJSONOptionsSchema = z.object({
  bin: binRecordSchema.optional(),
});

// -------------------------------------------
// symlx.config.json options: should allow configuring all options
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
  binResolutionStrategy: z.enum(['replace', 'merge']).optional(),
});

// -------------------------------------------
// varying command inline options: highest priority in field:value resolution
// -------------------------------------------

const serveInlineOptionsSchema = configFileOptionsSchema
  .pick({
    binDir: true,
    collision: true,
    nonInteractive: true,
    binResolutionStrategy: true,
  })
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
