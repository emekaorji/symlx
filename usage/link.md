# `link` Usage Scenarios

`link` resolves bins, creates command entries, prints results, and exits immediately.
Unlike `serve`, it does not keep a live session and does not auto-clean on process exit.

## Command

```bash
symlx link [options]
# alias
cx link [options]
```

## Options

| Option                                 | Type                                  | Default        | Description                                                           |
| -------------------------------------- | ------------------------------------- | -------------- | --------------------------------------------------------------------- |
| `--bin-dir <dir>`                      | string                                | `~/.symlx/bin` | Target directory where command links are created.                     |
| `--collision <policy>`                 | `prompt \| skip \| fail \| overwrite` | `prompt`       | What to do when a command name already exists in bin dir.             |
| `--bin-resolution-strategy <strategy>` | `replace \| merge`                    | `replace`      | How to resolve `bin` across `package.json`, config, and inline flags. |
| `--non-interactive`                    | boolean                               | `false`        | Disable prompts and force non-interactive behavior.                   |
| `--bin <name=path>` (repeatable)       | string[]                              | `[]`           | Inline bin mapping (for quick overrides/ad-hoc runs).                 |

## Happy Path

```bash
symlx link
```

Expected outcome:

- commands are created in your bin dir
- shebang targets are linked directly
- shebang-less supported targets use launchers automatically
- process exits with status `0`

## Override One Command Inline

```bash
symlx link --bin admin=dist/admin.js
```

Expected outcome:

- inline `admin` target is used based on normal precedence
- command is linked once and remains until manually replaced/removed

## Shebang-less Target Examples

### JavaScript Target Without Shebang

```bash
symlx link --bin my-cli=dist/cli.js
```

Expected outcome:

- symlx creates a Node launcher for the command

### TypeScript Target Without Shebang

```bash
symlx link
```

Expected outcome:

- symlx creates executable `tsx` launchers for supported TS targets
- if `tsx` is missing, command fails early with manual-shebang guidance

## Collision Flows

### Skip on Conflict

```bash
symlx link --collision skip
```

Expected outcome:

- conflicting commands are skipped
- non-conflicting commands are still linked
- process exits `0` if at least one link is created

### Fail on Conflict

```bash
symlx link --collision fail
```

Expected outcome:

- first conflict throws
- process exits `1`
- no silent fallback

### Prompt Requested in Non-Interactive Session

```bash
symlx link --collision prompt --non-interactive
```

Expected outcome:

- warning is printed
- policy falls back to `skip`

## Edge Cases and Recovery

### No Bin Entries Resolved

```bash
symlx link
```

when no `bin` exists in package/config/inline.

Expected failure:

- process exits `1`
- error tells exactly where to add bin entries

Recovery:

1. add `bin` in `package.json`, or
2. add `bin` in `symlx.config.json`, or
3. pass `--bin name=relative/path`

### All Candidates Skipped

This happens when every resolved command conflicts and policy resolves to skip.

Expected failure:

- process exits `1`
- error includes skipped command reasons and next action hint (`overwrite` or `fail`)

### Unsupported Without Shebang

If target has no shebang and symlx cannot support that launcher path yet:

- process exits `1`
- error tells you this is not supported yet without shebang
- error tells you to explicitly specify shebang in target file

### TypeScript Target Uses Node Shebang

If a `.ts`/`.tsx`/`.mts`/`.cts` target file declares a `node` shebang:

- process exits `1`
- error tells you this target is not directly runnable
- error tells you to use `#!/usr/bin/env tsx` or remove shebang for launcher inference

### Invalid Bin Target

If a resolved bin target is missing, cannot be made executable, is a directory, or is unsupported in the no-shebang path:

- process exits `1`
- error tells the exact command and target issue

Recovery:

1. build the target (`dist/...`)
2. ensure the target file exists
3. add explicit shebang to target file when launcher path is unavailable
4. if target is TypeScript and you prefer no-shebang flow, install `tsx` locally or make it available on `PATH`
5. if permission repair still fails for direct-link targets, set executable permission manually (`chmod +x`)
