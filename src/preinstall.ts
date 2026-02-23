const PREFIX = '[symlx]';

function info(message: string): void {
  process.stdout.write(`${PREFIX} ${message}\n`);
}

function run(): void {
  info(
    'notice: install will update your shell profile PATH with $HOME/.symlx/bin',
  );
  info('set SYMLX_SKIP_PATH_SETUP=1 to skip automatic PATH setup');
}

run();
