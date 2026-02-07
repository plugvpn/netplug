/**
 * Next.js Instrumentation Hook
 * This runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize log capture first to capture all startup logs
    const { logCapture } = await import('./lib/log-capture');
    logCapture.initialize();

    const { runStartupTasks } = await import('./lib/startup');
    await runStartupTasks();
  }
}
