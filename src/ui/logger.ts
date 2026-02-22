const PREFIX = "[symlx]";

// Thin logging wrappers keep formatting centralized and easy to swap later.
export function info(message: string): void {
  process.stdout.write(`${PREFIX} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${PREFIX} ${message}\n`);
}

export function error(message: string): void {
  process.stderr.write(`${PREFIX} ${message}\n`);
}
