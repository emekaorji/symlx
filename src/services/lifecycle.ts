type CleanupFn = () => void;

export function registerLifecycleCleanup(cleanup: CleanupFn): void {
  let cleaned = false;

  const runCleanup = (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    cleanup();
  };

  process.on("exit", runCleanup);

  const onSignal = (): void => {
    runCleanup();
    process.exit(0);
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onSignal);

  process.on("uncaughtException", (error) => {
    process.stderr.write(`[zlx] uncaught exception: ${String(error)}\n`);
    runCleanup();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    process.stderr.write(`[zlx] unhandled rejection: ${String(reason)}\n`);
    runCleanup();
    process.exit(1);
  });
}
