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
3. Prepare all resolved bin targets.
4. For each target: use shebang when present, otherwise infer launcher.
5. Cleanup stale sessions.
6. Create links with collision policy.
7. Persist session metadata.
8. Keep process alive and cleanup on exit.

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

Target file includes shebang:

```js
#!/usr/bin/env node
console.log('foo')
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

## 5) TypeScript target with explicit shebang

`package.json`:

```json
{
  "name": "my-cli",
  "bin": {
    "my-cli": "./src/cli.ts"
  }
}
```

`src/cli.ts` starts with:

```ts
#!/usr/bin/env tsx
```

Run:

```bash
symlx serve
```

Outcome:

- symlx links target directly
- command runs via declared shebang runtime

## 6) TypeScript target without shebang

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

## 7) JavaScript target without shebang

Run:

```bash
symlx serve --bin my-cli=dist/cli.js
```

Outcome:

- symlx creates a Node launcher
- launcher runs target via Node directly

## 8) Custom bin directory

Run:

```bash
symlx serve --bin-dir ~/.not-symlx/bin
```

Outcome:

- links are created in provided target directory

## Collision Scenarios

## 9) Prompt mode

Run:

```bash
symlx serve --collision prompt
```

Outcome:

- interactive choice per conflict: overwrite / skip / abort

## 10) Skip mode

Run:

```bash
symlx serve --collision skip
```

Outcome:

- conflicting names are skipped
- non-conflicting names still link

## 11) Fail mode

Run:

```bash
symlx serve --collision fail
```

Outcome:

- first collision throws and stops linking

## 12) Overwrite mode

Run:

```bash
symlx serve --collision overwrite
```

Outcome:

- conflicting entries are replaced

## 13) Prompt requested in non-interactive mode

Run:

```bash
symlx serve --collision prompt --non-interactive
```

Outcome:

- warning is shown
- fallback policy becomes `skip`

## Resolution Scenarios

## 14) Replace strategy (default)

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

## 15) Merge strategy from CLI

Run:

```bash
symlx serve --bin-resolution-strategy merge --bin tool-inline=dist/inline.js
```

Outcome:

- package/config/inline bins are combined

## Validation and Edge Cases

## 16) Missing `package.json`

Run in directory without `package.json` and without any config/inline bins.

Outcome:

- explicit error: "package.json not found"

## 17) Invalid `package.json` JSON

Outcome:

- explicit parse error with file path

## 18) No bin entries anywhere

Outcome:

- error with exact locations where bin can be defined

## 19) Bin string without package name

`package.json`:

```json
{
  "bin": "./dist/cli.js"
}
```

Outcome:

- error: cannot infer command name, set valid package name

## 20) Invalid inline bin name

Run:

```bash
symlx serve --bin "xin ping=dist/cli.js"
```

Outcome:

- schema error (name format invalid)

## 21) Invalid inline bin path (absolute)

Run:

```bash
symlx serve --bin "xin-ping=/tmp/cli.js"
```

Outcome:

- schema error (absolute target not allowed)

## 22) Missing target file

Any resolved bin pointing to missing file.

Outcome:

- early runtime validation error before link creation

## 23) Target is a directory

Outcome:

- early runtime validation error

## 24) Target has no shebang and no supported launcher

Outcome:

- early runtime validation error
- message tells user this is not supported yet without shebang and to specify shebang manually

## 25) Target is not executable (unix-like)

Outcome:

- for direct-link targets with shebang, symlx makes the target executable before linking

## 26) TypeScript target without tsx

Outcome:

- early runtime validation error telling you this path is not supported yet without shebang
- message still guides manual shebang declaration

## 27) Invalid config for non-critical keys

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

## 28) Invalid config for critical key (`binDir`)

Outcome:

- hard validation error

## Lifecycle Scenarios

## 29) Controlled exit

Stop with `Ctrl+C`.

Outcome:

- active session links removed
- session metadata file removed

## 30) Stale crash recovery

Previous run crashed and left stale session metadata.

Outcome:

- stale session links are cleaned on next startup

## Troubleshooting Map

## "package.json not found"

- run in project root
- or provide bins via config/inline

## "not supported yet without shebang"

- add shebang to target file to declare runner explicitly

## "no bin entries found"

- add `bin` in package.json
- or add `bin` in symlx.config.json
- or pass `--bin name=path`

## "invalid bin targets"

- confirm file exists
- confirm path is relative in config/inline
- if target has no shebang, ensure target type launcher is supported and runtime exists
- if this still fails, add explicit shebang to target file
- if symlx still fails for direct-link targets, fix file permission manually (`chmod +x`)

## "no links were created because all candidate commands were skipped"

- switch collision policy to:
  - `--collision overwrite`
  - `--collision fail`
