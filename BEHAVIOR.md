# Symlx Behavior and DX Validation

## Verdict

`symlx` is now in a strong usable state with a much tighter DX baseline.
It is substantially improved versus the initial 0.1.x baseline, with remaining gaps mostly around command breadth and advanced automation.

The core mechanics are solid:

- link lifecycle cleanup works
- collision policies are implemented
- option source resolution works
- install-time PATH setup is automated and idempotent

Most impactful DX gaps from the initial audit were addressed:

- README is now a full usage guide
- `--bin-resolution-strategy` is available on CLI
- malformed `package.json` gets targeted errors
- bin targets are validated before linking
- package binary surface is now canonicalized to `symlx`

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
| 08  | No `package.json`                        | `symlx serve` in empty folder                       | Fails with explicit `package.json not found ...` guidance      | Good       | Keep                                                   |
| 09  | Invalid `package.json` JSON              | malformed `package.json`                            | Fails with explicit parse error and file path                  | Good       | Keep                                                   |
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
| 20  | Merge strategy via CLI flag              | `--bin-resolution-strategy merge`                   | Works and is validated through schema                          | Good       | Keep                                                   |
| 21  | Collision `fail`                         | conflicting target path + `--collision fail`        | Immediate clear error; no mutation                             | Good       | Keep                                                   |
| 22  | Collision `overwrite`                    | conflicting target path + overwrite                 | Replaces and links                                             | Good       | Keep                                                   |
| 23  | Collision `skip` all-collide             | only conflicts + skip                               | Ends with `no links were created`                              | Fair       | Include skipped count/reasons in terminal error        |
| 24  | Collision `prompt` in non-interactive    | `--collision prompt --non-interactive`              | Warns, falls back to skip, then may fail with no links created | Fair       | Suggest switching to `overwrite`/`fail` in warning     |
| 25  | Partial collision (`skip`)               | one conflict + one free name                        | Links free names, warns skipped conflict                       | Good       | Keep                                                   |
| 26  | Lifecycle cleanup on Ctrl+C              | start serve then SIGINT                             | symlink and session removed                                    | Very good  | Keep                                                   |
| 27  | Stale session cleanup                    | dead pid in session file                            | stale links/session reaped on next run                         | Good       | Keep                                                   |
| 28  | PATH hint during serve                   | binDir not in PATH                                  | prints `export PATH=...` guidance                              | Good       | Keep                                                   |
| 29  | PATH hint suppressed                     | binDir already in PATH                              | no redundant hint                                              | Good       | Keep                                                   |
| 30  | Missing target file in bin map           | link points to non-existent file                    | Fails early with actionable validation message                 | Good       | Keep                                                   |
| 31  | Readability of fatal errors              | thrown errors via top-level catch                   | prefixed error output                                          | Good       | Add error codes for scripting                          |
| 32  | Logs for created links                   | successful link run                                 | prints each `name -> target`                                   | Good       | Keep                                                   |
| 33  | Docs for runtime flow                    | current README                                      | detailed install/usage/config/troubleshooting guide            | Good       | Keep                                                   |
| 34  | Naming clarity                           | package/bin                                          | canonical command name is `symlx`                             | Good       | Keep                                                   |
| 35  | Test confidence                          | no automated tests yet                              | runtime quality depends on manual checks                       | Weak       | Add unit+integration+E2E test baseline                 |


## Friction Points That Block "Best DX"

1. No JSON/machine-readable output mode yet for scripted CI usage.
2. Only `serve` exists today; status/doctor/cleanup commands are still pending.
3. Cross-platform Windows command-link behavior is not implemented yet.
4. Test surface is now present but still not full end-to-end matrix coverage.

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

1. Add machine-readable output mode (`--json`) for serve and future commands.
2. Add `status`, `cleanup`, and `doctor` command set.
3. Expand test suite with full collision matrix and stale-session regression tests.
4. Add Windows support strategy and test coverage.
5. Add CI workflow running `check + build + test + pack smoke`.

## Notes

- This file evaluates **developer experience behavior**, not only implementation internals.
- Rows marked weak/fair are the highest-leverage fixes to move `symlx` from usable to excellent.
