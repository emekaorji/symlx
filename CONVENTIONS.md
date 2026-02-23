# Symlx Code Conventions

This file defines stable coding paradigms and style rules.
Runtime behavior and current feature semantics are documented in `IMPLEMENTATION.md`.

## Architecture conventions

1. `src/cli.ts` defines command surface only (flags, descriptions, handler wiring).
2. `src/commands/*` orchestrates command flow and side effects.
3. `src/lib/*` contains reusable domain logic and pure helpers.
4. `src/ui/*` is presentation-only (logs/prompts), not business decision logic.
5. Cross-layer imports should flow inward (`cli -> commands -> lib/ui`), never the reverse (i.e. `commands/*` should not import from `cli`, `lib/*` or `ui/*` should not import from `commands/*` or `cli`).

## Validation and schema conventions

1. Zod schemas live in `src/lib/schema.ts`.
2. Validation wrappers live in `src/lib/validator.ts`.
3. Commands should consume validated objects, not raw untyped option input.
4. Keep validation and transformation close to schema definitions.

## Option handling conventions

1. Option source aggregation must happen in one place: `src/lib/options.ts`.
2. Option resolution must be deterministic and documented where implemented.
3. Command handlers should not duplicate merge logic.

## Safety conventions

1. Never delete directories as part of link conflict handling.
2. Never delete files/symlinks that were not created/owned by this project.
3. Destructive operations must be explicit, narrow, and auditable in code.

## Logging and errors conventions

1. Use `src/ui/logger.ts` for user-facing logs.
2. Error messages must be actionable and concise.
3. Warning messages should explain fallback behavior.
4. Avoid hidden failures; either handle with explicit fallback or throw.

## TypeScript and style conventions

> (should probably setup eslint)

1. Keep strict typing enabled.
2. Prefer explicit domain types over `any` (no any🤮).
3. Use single quotes and semicolons.
4. Prefer small functions with single responsibility.
5. Prefer named exports for reusable modules.
6. Keep comments intent-focused ("why"), not narrating obvious syntax ("what").

## Type location conventions

1. Shared types must live in the shared types area (`src/lib/types.ts` or a future `src/types/*`).
2. Single-use types should be defined close to where they are used.
3. Promote a local type to shared when reused across modules.

## Naming conventions

1. Use descriptive names, no abbreviations.
2. Keep function names verb-based (`resolveOptions`, `validateConfigFileOptions`).
3. Keep type names noun-based (`Options`, `SessionRecord`).

## Change discipline

1. Keep behavior changes and refactors scoped; avoid mixed-purpose commits.
2. Update `IMPLEMENTATION.md` when behavior changes.
3. Run `pnpm run check` and `pnpm run build` before merging behavior-affecting changes.
