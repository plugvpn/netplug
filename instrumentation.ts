/**
 * Next.js Instrumentation Hook
 * This runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Avoid opening log files during `next build` (standalone tracing may try to copy them).
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return;
    }
    // Initialize log capture first to capture all startup logs
    const { logCapture } = await import('./lib/log-capture');
    logCapture.initialize();

    const { runStartupTasks } = await import('./lib/startup');
    await runStartupTasks();
  }
}
