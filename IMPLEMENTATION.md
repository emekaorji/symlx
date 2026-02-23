# Symlx Implementation Notes

This document describes the current runtime behavior and feature semantics.
These details may change as the product evolves.

## Current command surface

- `symlx serve`
  - options include:
    - `--bin-dir`
    - `--collision`
    - `--non-interactive`
    - repeatable `--bin name=./path`

## Runtime flow (`serve`)

1. Resolve options from multiple sources in `src/lib/options.ts`.
2. Cleanup stale sessions.
3. Ensure runtime directories exist.
4. Resolve final bin map.
5. Create command links with collision handling.
6. Persist session file.
7. Register lifecycle cleanup handlers.
8. Keep process alive until interrupted.

## Option source resolution (current)

Implemented in `resolveOptions()`:

1. defaults
2. package.json-derived values
3. config file values
4. inline CLI values

`bin` may use either strategy:

- `replace` (winner source)
- `merge` (overlay sources)

## Validation policy (current)

- Schemas are defined in `src/lib/schema.ts`.
- Validation wrappers are in `src/lib/validator.ts`.
- Config has mixed strict/fallback behavior:
  - some fields fail on invalid values
  - some fields fallback with warnings

## Bin inputs (current)

Bin values can come from:

1. `package.json` `bin`
2. `symlx.config.json` `bin`
3. inline `--bin` entries

Inline `--bin` is transformed into `Record<string, string>` before option resolution.

## Session and cleanup behavior (current)

- Session metadata is written to the sessions directory.
- On startup, stale sessions are pruned.
- On exit/signals/fatal events, cleanup attempts to unlink only known symlinks.

## Interactive behavior (current)

- Collision prompt is used when collision policy is `prompt` and TTY is interactive.
- Non-interactive contexts use fallback behavior.
