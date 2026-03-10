# tl:dr

In a CLI project with:

```json
{
  "name": "awesome-cli",
  "bin": {
    "awesome-cli": "./dist/cli.js"
  }
}
```

run:

```bash
symlx link
```

Then use your CLI normally:

```bash
awesome-cli --help
```

Use `symlx serve` when you want temporary session-scoped links with auto-cleanup on exit.

---

# symlx

Temporary command linker for local CLI development.

`symlx serve` links command names from your project into a runnable bin directory for the lifetime of the process.
When `symlx` stops, those links are cleaned up.
`symlx link` creates the same links once and exits immediately.

## Why symlx

During CLI development, running `node dist/cli.js` repeatedly is noisy.
`npm link` has generally been buggy and slow to pick recent code changes.
`symlx` gives you the real command experience (`my-cli --help`) without a global publish/install cycle.

Core guarantees:

- Links are session-scoped and cleaned on exit.
- Collision behavior is explicit (`prompt`, `skip`, `fail`, `overwrite`).
- Option resolution is deterministic.
- Target execution is hybrid by default:
  - shebang present -> direct link
  - no shebang -> launcher inference by target type
- PATH setup for `~/.symlx/bin` is automated on install (with opt-out).

## Install

```bash
npx symlx serve
# or
npm i -g symlx
```

## Alias

`symlx` can be clackful for power users, hence its alias: `cx`.

Equivalent commands:

```bash
symlx serve
symlx link
cx serve
cx link
```

## Command Reference

## `symlx serve`

Links commands from resolved bin mappings and keeps the process alive until interrupted.

### Options

| Option                                 | Type                                  | Default        | Description                                                           |
| -------------------------------------- | ------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `--bin-dir <dir>`                      | string                                | `~/.symlx/bin` | Target directory where command links are created.                     |
| `--collision <policy>`                 | `prompt \| skip \| fail \| overwrite` | `prompt`       | What to do when a command name already exists in bin dir.             |
| `--bin-resolution-strategy <strategy>` | `replace \| merge`                    | `replace`      | How to resolve `bin` across `package.json`, config, and inline flags. |
| `--non-interactive`                    | boolean                               | `false`        | Disable prompts and force non-interactive behavior.                   |
| `--bin <name=path>` (repeatable)       | string[]                              | `[]`           | Inline bin mapping (for quick overrides/ad-hoc runs).                 |

Examples:

```bash
symlx serve --collision overwrite
symlx serve --bin admin=dist/admin.js --bin worker=dist/worker.js
symlx serve --bin-resolution-strategy merge
```

## `symlx link`

Links commands from resolved bin mappings and exits immediately.

It uses the exact same options and resolution behavior as `symlx serve`, _but it does not keep a live session_.

Examples:

```bash
symlx link
symlx link --collision overwrite
symlx link --bin admin=dist/admin.js
```

## Bin Resolution Model

`symlx` resolves options from three user sources plus defaults:

1. `package.json`
2. `symlx.config.json`
3. inline CLI flags

Scalar fields (`collision`, `binDir`, `nonInteractive`, `binResolutionStrategy`) follow normal override order:

`defaults -> package.json-derived -> config -> inline`

`bin` uses strategy mode:

- `replace` (default): first non-empty wins by priority `inline > config > package.json > default`
- `merge`: combines all
  `package.json + config + inline` (right-most source overrides key collisions)

## Supported Bin Sources

## `package.json`

`bin` supports both npm-compatible linking:

```json
{
  "name": "my-cli",
  "bin": "./dist/cli.js"
}
```

```json
{
  "bin": {
    "my-cli": "./dist/cli.js",
    "my-admin": "./dist/admin.js"
  }
}
```

If `bin` is a string, `name` is required so command name can be inferred.

## `symlx.config.json`

```json
{
  "binDir": "~/.symlx/bin",
  "collision": "prompt",
  "nonInteractive": false,
  "binResolutionStrategy": "replace",
  "bin": {
    "my-cli": "./dist/cli.js"
  }
}
```

Notes:

- In case of invalid non-critical config values, `symlx` falls back to defaults (with warnings).
- `binDir` is treated as critical and must pass validation.

## Inline Flags

```bash
symlx serve --bin my-cli=dist/cli.js

# multiple inline bins
symlx serve \
  --bin xin-ping=./cli.js \
  --bin admin=./scripts/admin.js
```

`name` rules:

- lowercase letters, digits, `-`
- no spaces

`path` rules:

- must be relative (for example `dist/cli.js` or `./dist/cli.js`)
- absolute paths are rejected

## Target Execution Model (Hybrid by Default)

For each resolved target file:

- if target has a shebang, symlx links it directly
- if target has no shebang, symlx infers launcher by file type

Current launcher inference:

- `.js`, `.mjs`, `.cjs` -> Node launcher
- `.ts`, `.tsx`, `.mts`, `.cts` -> `tsx` launcher
- if a TypeScript target declares `#!/usr/bin/env node`, symlx fails early and tells you to use `tsx` shebang or remove shebang for launcher inference

TypeScript runtime resolution order is:

1. project-local `node_modules/.bin/tsx`
2. `tsx` on `PATH`

If target has no shebang and launcher support is unavailable, symlx fails with a clear message that this is not supported yet without shebang and asks you to manually add shebang.

## Collision Policies

- `prompt`: ask per conflict (interactive TTY only)
- `skip`: keep existing command, skip link
- `fail`: stop on first conflict
- `overwrite`: replace existing entry

If `prompt` is requested in non-interactive mode, symlx falls back to `skip` and warns.

## Install-Time PATH Setup

On install, `symlx` updates shell profile PATH block.

Managed path:

```bash
$HOME/.symlx/bin
```

Opt out:

```bash
SYMLX_SKIP_PATH_SETUP=1 npm i -g symlx
```

To set a custom bin directory:

```bash
symlx serve --bin-dir ~/.symlx/bin
```

## Runtime Safety Checks

Before linking, symlx prepares each resolved bin target:

- file exists
- target is not a directory
- shebang path: direct link + executable permission repair when possible
- no-shebang path: launcher inference + runtime availability checks

Missing targets, directories, unsupported no-shebang target types, missing launcher runtimes, and permission-update failures fail early with actionable messages.

## Exit Behavior

- `Ctrl+C` (SIGINT), SIGTERM, SIGHUP, uncaught exception, and unhandled rejection trigger cleanup.
- Session metadata is stored under `~/.symlx/sessions`.
- Stale sessions leftover due to hard crashes are cleaned on startup.

## Troubleshooting

## "not supported yet without shebang"

- add a shebang to the target file to declare its runner explicitly

## "no bin entries found"

Add a bin mapping in at least one place:

- `package.json -> bin`
- `symlx.config.json -> bin`
- `--bin name=path`

## "command conflicts at ..."

Use a collision mode:

```bash
symlx serve --collision overwrite
# or
symlx serve --collision fail
```

## "tsx runtime could not be resolved for target"

Install `tsx` in the project or make `tsx` available on `PATH`.

## "typescript target uses node shebang and is not directly runnable"

- replace shebang with `#!/usr/bin/env tsx`
- or remove shebang and let symlx infer launcher by file type

## "package.json not found"

Run in your project root, or pass bins inline/config.

## Development

```bash
pnpm install
pnpm run check
pnpm run build
pnpm run test
```

## Extending Commands (Contributor Contract)

To add a new command while preserving set conventions:

1. Define command surface in `src/cli.ts`.
2. Keep orchestration in `src/commands/*`.
3. Reuse `resolveOptions()` for deterministic source handling.
4. Validate user-facing options with zod schemas in `src/lib/schema.ts`.
5. Add behavior coverage in `test/*.test.ts`.
6. Update this README command reference and examples.

The goal is consistent behavior across all current and future commands.
