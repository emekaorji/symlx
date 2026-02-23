# Symlx Conventions

This is the source-of-truth document for code conventions and architecture expectations in `symlx-cli`.

## Document name

Use `CONVENTIONS.md` for internal engineering rules.
If this project becomes widely open-source, keep this file and also add a short `CONTRIBUTING.md` that links here.

## Paradigm check (start vs now)

| Area | Initial direction | Current implementation | Convention going forward |
|---|---|---|---|
| CLI orchestration | `commander` entrypoint with `serve` command | `commander` still used in `src/cli.ts` | Keep command definitions in `src/cli.ts`; keep command logic in `src/commands/*` |
| Runtime lifecycle | long-running `serve` with cleanup on signals/exit | same behavior via `lib/lifecycle.ts` + `lib/session-store.ts` | Keep cleanup idempotent and best-effort |
| Linking engine | dedicated link manager with collision policies | same behavior in `lib/link-manager.ts` | No destructive directory deletes; only unlink known files/symlinks |
| Options/validation | inline parsing in command layer | centralized option resolution in `lib/options.ts` + zod schemas in `lib/schema.ts` | Keep all source merge and precedence in `lib/options.ts` |
| Option sources | mostly package/bin driven | defaults + package.json + config + inline CLI | Preserve deterministic precedence and document it in code comments |
| Bin source behavior | one source at a time | supports `replace` and `merge` strategy | Default remains `replace`; `merge` is opt-in |
| Prompting | prompt when collision policy is `prompt` | same behavior through `ui/prompts.ts` | Never prompt in non-interactive sessions |
| Module layout | `core/services/ui` split | refactored into `lib/`, `commands/`, `ui/` | Keep domain logic in `lib/`, command orchestration in `commands/` |

## Architecture conventions

1. `src/cli.ts` only defines command surface: flags, help text, and command handlers.
2. `src/commands/*` orchestrates command flow and side effects.
3. `src/lib/*` contains reusable domain logic (options, validation, linking, lifecycle, session handling, shared utilities).
4. `src/ui/*` is only for terminal presentation (logs/prompts), not business rules.

## Option resolution conventions

`resolveOptions()` in `src/lib/options.ts` is the only place that may combine options from multiple sources.

Default source order is:

1. hardcoded defaults
2. `package.json`-derived options
3. `symlx.config.json`
4. inline CLI options

Bin resolution rule:

- `replace` mode: choose first non-empty bin map by precedence (`inline -> config -> package.json -> default`).
- `merge` mode: overlay maps (`package.json -> config -> inline`).

## Validation conventions

1. Schemas live in `src/lib/schema.ts`.
2. Parsing helpers live in `src/lib/validator.ts`.
3. Critical config fields should fail parsing when invalid.
4. Non-critical config fields may fallback to default and emit warning logs.
5. Validation errors must include field path and readable cause.

## Bin conventions

1. Canonical runtime shape for bins is `Record<string, string>`.
2. CLI repeatable `--bin` input is parsed into `Record<string, string>` before command execution.
3. Bin names should follow lowercase kebab style.
4. Bin targets should be explicit relative paths (for portability).

## Error and logging conventions

1. User-facing errors should be actionable and concise.
2. Missing bin sources must list supported input locations (package.json, config, inline CLI).
3. Warnings are for recoverable fallback behavior.
4. Logs must use `ui/logger.ts` for consistent prefixing and formatting.

## Safety conventions

1. Never overwrite directories during link creation.
2. Never delete links unless they still point to the known target from session metadata.
3. Keep stale-session cleanup best-effort and non-fatal.
4. Handle crash/kill scenarios via startup stale cleanup.

## Style conventions

1. TypeScript strict mode stays enabled.
2. Use single quotes and semicolons consistently.
3. Prefer named exports for reusable helpers.
4. Keep comments short and intent-focused (why, not obvious what).

## Contributor checklist

Before opening a change:

1. Update/add schema types for new options.
2. Keep merge precedence logic only in `resolveOptions()`.
3. Add/adjust command help text in `src/cli.ts`.
4. Run `pnpm run check`.
5. Run `pnpm run build`.
6. Verify at least one real `symlx serve` flow for runtime changes.
