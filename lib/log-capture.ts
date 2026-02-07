/**
 * Log Capture Service
 * Intercepts stdout and stderr streams and writes them to a log file
 */

import fs from 'fs';
import path from 'path';
import { createWriteStream, WriteStream } from 'fs';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'stdout' | 'stderr';
  message: string;
  category?: string; // Extracted from log message (e.g., [Startup], [WireGuard])
}

class LogCaptureService {
  private logFilePath: string;
  private logStream: WriteStream | null = null;
  private originalStdoutWrite: typeof process.stdout.write;
  private originalStderrWrite: typeof process.stderr.write;
  private isInitialized = false;
  private maxLogSizeBytes = 10 * 1024 * 1024; // 10 MB max log file size

  constructor() {
    // Store original stream write methods
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
    this.originalStderrWrite = process.stderr.write.bind(process.stderr);

    // Set log file path in project root
    this.logFilePath = path.join(process.cwd(), 'server.log');
  }

  /**
   * Initialize log capture by intercepting stdout and stderr streams
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    // Create/open log file stream (append mode)
    this.logStream = createWriteStream(this.logFilePath, { flags: 'a' });

    // Intercept process.stdout.write
    process.stdout.write = ((write) => {
      return (chunk: any, encoding?: any, callback?: any): boolean => {
        // Capture the output
        const message = typeof chunk === 'string' ? chunk : chunk?.toString();
        if (message) {
          this.captureLog('stdout', message);
        }

        // Call original write method
        return write.call(process.stdout, chunk, encoding, callback);
      };
    })(this.originalStdoutWrite) as typeof process.stdout.write;

    // Intercept process.stderr.write
    process.stderr.write = ((write) => {
      return (chunk: any, encoding?: any, callback?: any): boolean => {
        // Capture the output
        const message = typeof chunk === 'string' ? chunk : chunk?.toString();
        if (message) {
          this.captureLog('stderr', message);
        }

        // Call original write method
        return write.call(process.stderr, chunk, encoding, callback);
      };
    })(this.originalStderrWrite) as typeof process.stderr.write;

    this.isInitialized = true;
    console.log(`[LogCapture] Log capture service initialized - writing to ${this.logFilePath}`);

    // Check and rotate log file if too large
    this.checkAndRotateLog();
  }

  /**
   * Capture a log entry and write to file
   */
  private captureLog(level: 'stdout' | 'stderr', message: string) {
    try {
      // Skip empty messages
      if (!message || message.trim() === '') {
        return;
      }

      // Format: [TIMESTAMP] [LEVEL] message
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

      // Ensure message ends with newline
      const formattedLine = logLine.endsWith('\n') ? logLine : logLine + '\n';

      // Write to log file
      if (this.logStream) {
        this.logStream.write(formattedLine);
      }
    } catch (error) {
      // Failsafe: if log capture fails, don't break the application
      this.originalStderrWrite.call(
        process.stderr,
        `[LogCapture] Error capturing log: ${error}\n`
      );
    }
  }

  /**
   * Check log file size and rotate if necessary
   */
  private checkAndRotateLog() {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);

        // If log file is too large, rotate it
        if (stats.size > this.maxLogSizeBytes) {
          const backupPath = `${this.logFilePath}.old`;

          // Close current stream
          if (this.logStream) {
            this.logStream.end();
          }

          // Rename current log to .old (overwriting any existing .old file)
          fs.renameSync(this.logFilePath, backupPath);

          // Create new log stream
          this.logStream = createWriteStream(this.logFilePath, { flags: 'a' });

          console.log(`[LogCapture] Log file rotated - old log saved to ${backupPath}`);
        }
      }
    } catch (error) {
      console.error('[LogCapture] Error checking/rotating log file:', error);
    }
  }

  /**
   * Read and parse log entries from file
   */
  getLogs(options?: {
    level?: 'stdout' | 'stderr';
    category?: string;
    search?: string;
    limit?: number;
  }): LogEntry[] {
    try {
      // Read log file
      if (!fs.existsSync(this.logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      // Parse log lines
      let logs: LogEntry[] = [];
      let logCounter = 0;

      for (const line of lines) {
        // Parse format: [TIMESTAMP] [LEVEL] message
        const match = line.match(/^\[([^\]]+)\] \[(STDOUT|STDERR)\] (.*)$/);
        if (match) {
          const [, timestamp, level, message] = match;

          // Extract category from message if present
          const categoryMatch = message.match(/^\[([^\]]+)\]/);
          const category = categoryMatch ? categoryMatch[1] : undefined;

          logs.push({
            id: `log-${++logCounter}`,
            timestamp: new Date(timestamp),
            level: level.toLowerCase() as 'stdout' | 'stderr',
            message,
            category,
          });
        }
      }

      // Apply filters
      let filtered = logs;

      if (options?.level) {
        filtered = filtered.filter((log) => log.level === options.level);
      }

      if (options?.category) {
        filtered = filtered.filter((log) => log.category === options.category);
      }

      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        filtered = filtered.filter((log) =>
          log.message.toLowerCase().includes(searchLower)
        );
      }

      // Get last N logs (limit)
      const limit = options?.limit || 500;
      filtered = filtered.slice(-limit);

      // Return in chronological order (oldest first, newest last)
      return filtered;
    } catch (error) {
      console.error('[LogCapture] Error reading logs:', error);
      return [];
    }
  }

  /**
   * Clear log file
   */
  clearLogs() {
    try {
      if (this.logStream) {
        this.logStream.end();
      }

      // Truncate the log file
      fs.writeFileSync(this.logFilePath, '');

      // Reopen stream
      this.logStream = createWriteStream(this.logFilePath, { flags: 'a' });

      console.log('[LogCapture] Logs cleared');
    } catch (error) {
      console.error('[LogCapture] Error clearing logs:', error);
    }
  }

  /**
   * Get unique categories from logs
   */
  getCategories(): string[] {
    const logs = this.getLogs({ limit: 10000 });
    const categories = new Set<string>();

    logs.forEach((log) => {
      if (log.category) {
        categories.add(log.category);
      }
    });

    return Array.from(categories).sort();
  }

  /**
   * Get statistics about logs
   */
  getStats() {
    const logs = this.getLogs({ limit: 10000 });

    return {
      total: logs.length,
      stdout: logs.filter((log) => log.level === 'stdout').length,
      stderr: logs.filter((log) => log.level === 'stderr').length,
      categories: this.getCategories(),
      oldestTimestamp: logs[logs.length - 1]?.timestamp,
      newestTimestamp: logs[0]?.timestamp,
    };
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Restore original stdout/stderr (for cleanup/testing)
   */
  restore() {
    if (!this.isInitialized) {
      return;
    }

    process.stdout.write = this.originalStdoutWrite;
    process.stderr.write = this.originalStderrWrite;

    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }

    this.isInitialized = false;
    console.log('[LogCapture] Log capture service stopped');
  }

  /**
   * Cleanup and remove log file (called on server termination)
   */
  cleanup() {
    try {
      // Restore original streams
      this.restore();

      // Remove log file
      if (fs.existsSync(this.logFilePath)) {
        fs.unlinkSync(this.logFilePath);
        this.originalStdoutWrite.call(
          process.stdout,
          '[LogCapture] Log file removed\n'
        );
      }

      // Also remove .old backup if it exists
      const backupPath = `${this.logFilePath}.old`;
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (error) {
      this.originalStderrWrite.call(
        process.stderr,
        `[LogCapture] Error during cleanup: ${error}\n`
      );
    }
  }
}

// Export singleton instance
export const logCapture = new LogCaptureService();

// Setup cleanup handlers for graceful shutdown
if (typeof process !== 'undefined') {
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logCapture.cleanup();
    process.exit(0);
  });

  // Handle SIGTERM (kill command)
  process.on('SIGTERM', () => {
    logCapture.cleanup();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[LogCapture] Uncaught exception:', error);
    logCapture.cleanup();
    process.exit(1);
  });
}
