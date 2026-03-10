# `serve` Usage Scenarios

`serve` links resolved bin commands into a target bin directory and keeps them active until the process exits.

## Command

```bash
symlx serve [options]
# alias
cx serve [options]
```

## Core Flow

1. Resolve options from defaults, package.json, config, and inline flags.
2. Resolve final `bin` map with `replace` or `merge` strategy.
3. Prepare all resolved bin targets, make them executable when needed, and convert TypeScript targets into `tsx` launchers.
4. Cleanup stale sessions.
5. Create links with collision policy.
6. Persist session metadata.
7. Keep process alive and cleanup on exit.

## Happy Path Scenarios

## 1) Package bin object

`package.json`:

```json
{
  "name": "my-cli",
  "bin": {
    "my-cli": "./dist/cli.js"
  }
}
```

Run:

```bash
symlx serve
```

Outcome:

- `~/.symlx/bin/my-cli` is linked
- command works as `my-cli --help`
- link is removed on `Ctrl+C`

## 2) Package bin string

`package.json`:

```json
{
  "name": "my-cli",
  "bin": "./dist/cli.js"
}
```

Run:

```bash
symlx serve
```

Outcome:

- bin name inferred from package name (`my-cli`)
- command works as `my-cli --help`
- linked and cleaned on exit

## 3) Inline only (no package bin)

Run:

```bash
symlx serve --bin admin=dist/admin.js
```

Outcome:

- `admin` command is linked from inline mapping
- command works as `admin --help`

## 4) Merge strategy across all sources

`symlx.config.json`:

```json
{
  "binResolutionStrategy": "merge",
  "bin": {
    "cfg-tool": "./dist/cfg.js"
  }
}
```

Run:

```bash
symlx serve --bin inline-tool=dist/inline.js
```

Outcome:

- bins are merged from package + config + inline
- in this case, both `cfg-tool --help` and `inline-tool --help` works

## 5) TypeScript bin target

`package.json`:

```json
{
  "name": "my-cli",
  "bin": {
    "my-cli": "./src/cli.ts"
  }
}
```

Run:

```bash
symlx serve
```

Outcome:

- symlx creates a command launcher in the bin dir
- the launcher runs the real target through `tsx`
- `tsx` is resolved from local `node_modules/.bin/tsx` first, then `PATH`

## 6) Custom bin directory

Run:

```bash
symlx serve --bin-dir ~/.not-symlx/bin
```

Outcome:

- links are created in provided target directory

## Collision Scenarios

## 7) Prompt mode

Run:

```bash
symlx serve --collision prompt
```

Outcome:

- interactive choice per conflict: overwrite / skip / abort

## 8) Skip mode

Run:

```bash
symlx serve --collision skip
```

Outcome:

- conflicting names are skipped
- non-conflicting names still link

## 9) Fail mode

Run:

```bash
symlx serve --collision fail
```

Outcome:

- first collision throws and stops linking

## 10) Overwrite mode

Run:

```bash
symlx serve --collision overwrite
```

Outcome:

- conflicting entries are replaced

## 11) Prompt requested in non-interactive mode

Run:

```bash
symlx serve --collision prompt --non-interactive
```

Outcome:

- warning is shown
- fallback policy becomes `skip`

## Resolution Scenarios

## 12) Replace strategy (default)

Run:

```bash
symlx serve --bin tool-inline=dist/inline.js
```

Outcome:

- first non-empty bin source wins by priority:
  - inline
  - config
  - package
- i.e. if bin is specified inline, bin from the config or package.json is ignored

## 13) Merge strategy from CLI

Run:

```bash
symlx serve --bin-resolution-strategy merge --bin tool-inline=dist/inline.js
```

Outcome:

- package/config/inline bins are combined

## Validation and Edge Cases

## 14) Missing `package.json`

Run in directory without `package.json` and without any config/inline bins.

Outcome:

- explicit error: "package.json not found"

## 15) Invalid `package.json` JSON

Outcome:

- explicit parse error with file path

## 16) No bin entries anywhere

Outcome:

- error with exact locations where bin can be defined

## 17) Bin string without package name

`package.json`:

```json
{
  "bin": "./dist/cli.js"
}
```

Outcome:

- error: cannot infer command name, set valid package name

## 18) Invalid inline bin name

Run:

```bash
symlx serve --bin "xin ping=dist/cli.js"
```

Outcome:

- schema error (name format invalid)

## 19) Invalid inline bin path (absolute)

Run:

```bash
symlx serve --bin "xin-ping=/tmp/cli.js"
```

Outcome:

- schema error (absolute target not allowed)

## 20) Missing target file

Any resolved bin pointing to missing file.

Outcome:

- early runtime validation error before link creation

## 21) Target is a directory

Outcome:

- early runtime validation error

## 22) Target is not executable (unix-like)

Outcome:

- for JavaScript targets, symlx makes the target executable before linking

## 23) TypeScript target without tsx

Outcome:

- early runtime validation error telling you to install `tsx` locally or make it available on `PATH`

## 24) Invalid config for non-critical keys

`symlx.config.json`:

```json
{
  "collision": "banana",
  "nonInteractive": "nope"
}
```

Outcome:

- warning logs
- defaults applied

## 25) Invalid config for critical key (`binDir`)

Outcome:

- hard validation error

## Lifecycle Scenarios

## 26) Controlled exit

Stop with `Ctrl+C`.

Outcome:

- active session links removed
- session metadata file removed

## 27) Stale crash recovery

Previous run crashed and left stale session metadata.

Outcome:

- stale session links are cleaned on next startup

## Troubleshooting Map

## "package.json not found"

- run in project root
- or provide bins via config/inline

## "no bin entries found"

- add `bin` in package.json
- or add `bin` in symlx.config.json
- or pass `--bin name=path`

## "invalid bin targets"

- confirm file exists
- confirm path is relative in config/inline
- if the target is TypeScript, install `tsx` locally or make it available on `PATH`
- if symlx still fails for JavaScript, fix the file permission manually (`chmod +x`)

## "no links were created because all candidate commands were skipped"

- switch collision policy to:
  - `--collision overwrite`
  - `--collision fail`
