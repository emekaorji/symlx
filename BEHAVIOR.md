# Symlx Behavior and DX Validation

## Verdict

`symlx` is usable today, but it does **not** yet represent "world-best DX."

The core mechanics are solid:

- link lifecycle cleanup works
- collision policies are implemented
- option source resolution works
- install-time PATH setup is automated and idempotent

The biggest DX gaps are still material:

- discoverability gaps (`README.md` is placeholder)
- one hidden capability (`binResolutionStrategy`) is implemented but not exposed as CLI flag
- some failure modes are opaque (invalid/malformed `package.json` behaves like "no bins found")
- missing bin target files are not validated before linking, so users get a broken command later
- naming surface is inconsistent (`symlx` package still exposes both `symlx` and `cx` binaries)

## Assessment Method

This file combines:

- **validated behavior** from direct command runs
- **inferred behavior** from source inspection when platform/runtime setup was not feasible in this session

Validated environment:

- macOS + zsh
- Node 18+ runtime
- command runs via `node dist/cli.js ...` against isolated temp projects

## Behavior Matrix


| ID  | Scenario                                 | Sample Command                                      | Current Behavior                                               | DX Quality | Better DX                                              |
| --- | ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| 01  | CLI help                                 | `symlx --help`                                      | Shows clean top-level help and `serve` command                 | Good       | Keep                                                   |
| 02  | Serve help                               | `symlx serve --help`                                | Shows options and defaults                                     | Good       | Keep                                                   |
| 03  | Unknown option                           | `symlx serve --foo`                                 | Commander error + help                                         | Good       | Keep                                                   |
| 04  | Preinstall notice                        | `npm i symlx`                                       | Logs PATH mutation notice and opt-out env var                  | Good       | Keep                                                   |
| 05  | Postinstall success                      | `npm i symlx`                                       | Adds marker block to profile; prints `source ...` command      | Very good  | Keep                                                   |
| 06  | Postinstall opt-out                      | `SYMLX_SKIP_PATH_SETUP=1 npm i symlx`               | Skips mutation and prints manual setup                         | Good       | Keep                                                   |
| 07  | Postinstall early-return guidance        | write/permission/home/platform early return         | Prints manual setup block                                      | Good       | Keep                                                   |
| 08  | No `package.json`                        | `symlx serve` in empty folder                       | Fails with "no bin entries found..." message                   | Fair       | Include explicit "package.json not found" branch       |
| 09  | Invalid `package.json` JSON              | malformed `package.json`                            | Same output as missing bins                                    | Weak       | Explicit parse error with file path and line context   |
| 10  | `package.json` bin object                | `"bin": {"tool":"./dist/cli.js"}`                   | Resolves and links command                                     | Good       | Keep                                                   |
| 11  | `package.json` bin string + valid name   | `"name":"pkg","bin":"./dist/cli.js"`                | Infers bin name from package name                              | Good       | Keep                                                   |
| 12  | `package.json` bin string + missing name | `"bin":"./dist/cli.js"`                             | Fails with concise package-name guidance                       | Good       | Keep                                                   |
| 13  | Config non-critical invalid fields       | invalid `collision`/`nonInteractive`                | Warns and falls back to defaults                               | Good       | Keep                                                   |
| 14  | Config invalid `binDir`                  | `binDir` without dotted segment                     | Hard fail with schema message                                  | Fair       | Add rationale in error text; document prominently      |
| 15  | Inline `--bin` valid                     | `--bin inline-tool=runner.js`                       | Links inline command and runs correctly                        | Good       | Keep                                                   |
| 16  | Inline `--bin` invalid name              | `--bin "xin ping=./cli.js"`                         | Schema error: expected `<name=relative/path>`                  | Fair       | Return precise invalid-key message                     |
| 17  | Inline `--bin` invalid absolute path     | `--bin xin=/tmp/cli.js`                             | Schema error                                                   | Good       | Keep                                                   |
| 18  | Default bin precedence (`replace`)       | package + config bins                               | Config wins when non-empty                                     | Good       | Document as default prominently                        |
| 19  | Merge strategy via config                | `binResolutionStrategy: "merge"`                    | Package + config + inline are merged                           | Good       | Expose this in CLI help                                |
| 20  | Merge strategy via CLI flag              | `--bin-resolution-strategy merge`                   | Unknown option error                                           | Weak       | Add actual flag to `cli.ts`                            |
| 21  | Collision `fail`                         | conflicting target path + `--collision fail`        | Immediate clear error; no mutation                             | Good       | Keep                                                   |
| 22  | Collision `overwrite`                    | conflicting target path + overwrite                 | Replaces and links                                             | Good       | Keep                                                   |
| 23  | Collision `skip` all-collide             | only conflicts + skip                               | Ends with `no links were created`                              | Fair       | Include skipped count/reasons in terminal error        |
| 24  | Collision `prompt` in non-interactive    | `--collision prompt --non-interactive`              | Warns, falls back to skip, then may fail with no links created | Fair       | Suggest switching to `overwrite`/`fail` in warning     |
| 25  | Partial collision (`skip`)               | one conflict + one free name                        | Links free names, warns skipped conflict                       | Good       | Keep                                                   |
| 26  | Lifecycle cleanup on Ctrl+C              | start serve then SIGINT                             | symlink and session removed                                    | Very good  | Keep                                                   |
| 27  | Stale session cleanup                    | dead pid in session file                            | stale links/session reaped on next run                         | Good       | Keep                                                   |
| 28  | PATH hint during serve                   | binDir not in PATH                                  | prints `export PATH=...` guidance                              | Good       | Keep                                                   |
| 29  | PATH hint suppressed                     | binDir already in PATH                              | no redundant hint                                              | Good       | Keep                                                   |
| 30  | Missing target file in bin map           | link points to non-existent file                    | link still created; command later fails at invocation          | Weak       | Validate target existence/executability before linking |
| 31  | Readability of fatal errors              | thrown errors via top-level catch                   | prefixed error output                                          | Good       | Add error codes for scripting                          |
| 32  | Logs for created links                   | successful link run                                 | prints each `name -> target`                                   | Good       | Keep                                                   |
| 33  | Docs for runtime flow                    | current README placeholder                          | discoverability is poor                                        | Weak       | Replace README with production docs now                |
| 34  | Naming clarity                           | package/bin currently include both `symlx` and `cx` | command identity ambiguous                                     | Weak       | Use one canonical command                              |
| 35  | Test confidence                          | no automated tests yet                              | runtime quality depends on manual checks                       | Weak       | Add unit+integration+E2E test baseline                 |


## Friction Points That Block "Best DX"

1. No authoritative docs for first-time users.
2. One internal capability (`binResolutionStrategy`) is not reachable from CLI.
3. Broken-target links are possible because symlink creation happens before target validation.
4. Error messaging conflates missing bins vs malformed input in key cases.
5. Command identity is split (`symlx` and `cx`), which dilutes discoverability.
6. No test suite guarantees behavior stability.

## What "Best DX" Would Look Like in This Exact Tool

1. Single, obvious path to success.
  - Install command
  - One-liner serve command
  - obvious stop/cleanup behavior
  - no hidden flags or hidden capabilities
2. Actionable failures, never generic failures.
  - each error says what failed, why, and exactly what to run next
3. Zero surprise in precedence.
  - documented and reflected in both CLI help and config docs
4. No delayed runtime failures.
  - invalid/missing targets fail before linking
5. Fully scriptable behavior.
  - predictable exit codes
  - optional JSON output for machine use
6. Tight confidence loop.
  - automated tests validate every matrix row above

## Immediate Upgrades (High Impact, Low Risk)

1. Replace `README.md` with real install/serve/config/collision/preinstall-postinstall docs.
2. Add `--bin-resolution-strategy <replace|merge>` to `src/cli.ts`.
3. Add pre-link target checks in `src/commands/serve.ts` and fail with precise path errors.
4. Differentiate parse failures from missing bins in `src/lib/utils.ts` + `src/lib/options.ts`.
5. Remove binary alias ambiguity by picking one canonical bin in `package.json`.

## Notes

- This file evaluates **developer experience behavior**, not only implementation internals.
- Rows marked weak/fair are the highest-leverage fixes to move `symlx` from usable to excellent.

