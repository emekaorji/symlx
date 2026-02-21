const PREFIX = "[zlx]";

export function info(message: string): void {
  process.stdout.write(`${PREFIX} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${PREFIX} ${message}\n`);
}

export function error(message: string): void {
  process.stderr.write(`${PREFIX} ${message}\n`);
}
