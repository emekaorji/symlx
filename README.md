# symlx

Temporary CLI bin linker for local development.

## What it does

`symlx serve` reads the current project's `package.json` `bin` entries and symlinks them into:

`~/.symlx/bin`

While `symlx serve` is running, those commands can be used from anywhere (if `~/.symlx/bin` is on your `PATH`).

When the process exits, it removes only the links it created.

## Command framework and structure

`symlx` uses:

- `commander` for command orchestration and typed options.
- `prompts` for interactive/TUI collision handling.

Project layout:

- `src/commands` command handlers
- `src/services` bin/session/lifecycle services
- `src/core` shared types/path helpers
- `src/ui` terminal UI prompts/logging

## Usage

```bash
npx symlx serve
```

or if installed globally:

```bash
symlx serve
```

### Serve options

```bash
symlx serve --collision prompt
symlx serve --collision skip
symlx serve --collision fail
symlx serve --collision overwrite
symlx serve --non-interactive
symlx serve --bin-dir /custom/bin
```

If your shell does not already include `~/.symlx/bin`, add:

```bash
export PATH="$HOME/.symlx/bin:$PATH"
```

## Notes

- Prompt mode lets you choose overwrite/skip/abort when a command name already exists.
- In non-interactive sessions, prompt mode falls back to skip.
- Stale links from dead sessions are cleaned on the next startup.
- `kill -9` cannot cleanup instantly, but stale cleanup runs next time.
