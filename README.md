# zlx

Temporary CLI bin linker for local development.

## What it does

`zlx serve` reads the current project's `package.json` `bin` entries and symlinks them into:

`~/.zlx/bin`

While `zlx serve` is running, those commands can be used from anywhere (if `~/.zlx/bin` is on your `PATH`).

When the process exits, it removes only the links it created.

## Command framework and structure

`zlx` uses:

- `commander` for command orchestration and typed options.
- `prompts` for interactive/TUI collision handling.

Project layout:

- `src/commands` command handlers
- `src/services` bin/session/lifecycle services
- `src/core` shared types/path helpers
- `src/ui` terminal UI prompts/logging

## Usage

```bash
npx zlx serve
```

or if installed globally:

```bash
zlx serve
```

### Serve options

```bash
zlx serve --collision prompt
zlx serve --collision skip
zlx serve --collision fail
zlx serve --collision overwrite
zlx serve --non-interactive
zlx serve --bin-dir /custom/bin
```

If your shell does not already include `~/.zlx/bin`, add:

```bash
export PATH="$HOME/.zlx/bin:$PATH"
```

## Notes

- Prompt mode lets you choose overwrite/skip/abort when a command name already exists.
- In non-interactive sessions, prompt mode falls back to skip.
- Stale links from dead sessions are cleaned on the next startup.
- `kill -9` cannot cleanup instantly, but stale cleanup runs next time.
