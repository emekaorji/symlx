type CleanupFn = () => void;

// Registers robust process-exit handling so linked commands are removed reliably.
// Cleanup is idempotent and can be triggered by normal exit, signals, or fatal errors.
export function registerLifecycleCleanup(cleanup: CleanupFn): void {
  let cleaned = false;

  const runCleanup = (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    cleanup();
  };

  // Normal termination path.
  process.on("exit", runCleanup);

  const onSignal = (): void => {
    runCleanup();
    process.exit(0);
  };

  // Common interactive stop signals.
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onSignal);

  // Fatal process events still attempt cleanup before exiting with failure.
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
