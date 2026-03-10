# `link` Usage Scenarios

`link` resolves bins, creates command entries, prints results, and exits immediately.
Unlike `serve`, it does not keep a live session and does not auto-clean on process exit.

JavaScript targets are linked directly. TypeScript targets are launched through generated `tsx` wrappers.

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
- JavaScript targets become symlinks
- TypeScript targets become executable `tsx` launchers
- process exits with status `0`

## Override One Command Inline

```bash
symlx link --bin admin=dist/admin.js
```

Expected outcome:

- inline `admin` target is used based on normal precedence
- command is linked once and remains until manually replaced/removed

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

### Invalid Bin Target

If a resolved bin target is missing, cannot be made executable, is a directory, or is TypeScript without `tsx` available:

- process exits `1`
- error tells the exact command and target issue

Recovery:

1. build the target (`dist/...`)
2. ensure the target file exists
3. if the target is TypeScript, install `tsx` locally or make it available on `PATH`
4. if permission repair still fails for JavaScript, set executable permission manually (`chmod +x`)
