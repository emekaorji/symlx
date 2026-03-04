## Phase 1

- add command `symlx link` - one-shot link creation without long-running keepalive mode.

## Phase 2

- add command `symlx unlink` - removes links for the current project (or selected command names).

## Phase 3

- add command `symlx status` - shows active `symlx` session(s), linked commands, and target paths.

## Phase 4

- add command `symlx list` - resolved bins + source: package/config.

## Phase 5

- add command `symlx stop` - shows all running sessions by PID/session id and allow the user to select any for cleanup.

## Phase 6

- add command `symlx cleanup` - manual stale session cleanup and broken/orphan links.

## Phase 7

- add command `symlx doctor` - checks PATH, profile config, permissions, collisions, and reports fixes.

## Phase 8

- add command `symlx setup` - add the marker-managed block to the shell profile and set up session management

## Phase 9

- add command `symlx teardown` - removes the profile block added by `setup`.

## Phase 10

- add command `symlx which <cmd>` - shows where a linked command points and which session owns it.

## Phase 11

- add command `symlx config` - `init/get/set/print` for `symlx` config resolution.

## Phase 12

- add command `symlx run -- <command>` - temporarily links bins, runs one command, then auto-cleans immediately.

## Phase 13

- strengthen config model.
  - add a global config file inside `~/.symlx/global-config.json`, effectively introducing a new config layer: default -> global config -> package.json (`bin` only) -> project config -> inline options.
  - session TTL / auto-expiry policy. (start counting this after the last time the session was used - a session is used when the bin it links is called)

## Phase 14

- observability and ops.
  - add lightweight session metrics (your TODO about current session bin command call count/live feedback).
  - optional debug logging mode.
  - track cleanup outcomes for stale sessions.

## Phase 15

- configure more shells (fish, pwsh, etc).

## Phase 16

- add Windows strategy (this cli barely supports windows at the moment, which is very bad).

## Phase 17

- add uninstall command to script to remove `symlx` specific data from the system.
