'use client';

import { useEffect, useState, useRef } from 'react';
import { LogEntry } from '@/lib/log-capture';

interface ActivityLogStats {
  total: number;
  stdout: number;
  stderr: number;
  categories: string[];
  oldestTimestamp?: Date;
  newestTimestamp?: Date;
}

interface ActivityLogResponse {
  logs: LogEntry[];
  stats: ActivityLogStats;
  timestamp: string;
}

export function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState<'all' | 'stdout' | 'stderr'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Refs
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (levelFilter !== 'all') params.append('level', levelFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', '500'); // Limit to last 500 logs

      const response = await fetch(`/api/activity-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');

      const data: ActivityLogResponse = await response.json();
      setLogs(data.logs);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Clear logs
  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all activity logs?')) return;

    try {
      const response = await fetch('/api/activity-logs', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear logs');
      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs');
    }
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [levelFilter, categoryFilter, searchQuery]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, levelFilter, categoryFilter, searchQuery]);

  // Handle scroll - disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Format timestamp
  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Get level badge styling
  const getLevelBadge = (level: string) => {
    if (level === 'stderr') {
      return (
        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20">
          stderr
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20">
        stdout
      </span>
    );
  };

  // Get category badge styling
  const getCategoryBadge = (category?: string) => {
    if (!category) return null;

    const colors: Record<string, string> = {
      Startup: 'bg-purple-50 text-purple-700 ring-purple-600/10 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20',
      WireGuard: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
      API: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20',
      LogCapture: 'bg-gray-50 text-gray-700 ring-gray-600/10 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20',
      Database: 'bg-yellow-50 text-yellow-700 ring-yellow-600/10 dark:bg-yellow-500/10 dark:text-yellow-400 dark:ring-yellow-500/20',
    };

    const colorClass = colors[category] || 'bg-gray-50 text-gray-700 ring-gray-600/10 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20';

    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${colorClass}`}
      >
        {category}
      </span>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading activity logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Logs</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.total}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm text-gray-500 dark:text-gray-400">Stdout</div>
            <div className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">{stats.stdout}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm text-gray-500 dark:text-gray-400">Stderr</div>
            <div className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{stats.stderr}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm text-gray-500 dark:text-gray-400">Categories</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {stats.categories.length}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4">
          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="stdout">Stdout</option>
              <option value="stderr">Stderr</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">All Categories</option>
              {stats?.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Auto-refresh Toggle */}
          <div className="flex items-center gap-2 pt-6">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 peer-focus:ring-offset-2 dark:bg-gray-700 dark:after:border-gray-600 dark:peer-focus:ring-offset-gray-900"></div>
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Auto-refresh</span>
            </label>
          </div>

          {/* Clear Button */}
          <div className="pt-6">
            <button
              onClick={clearLogs}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Clear Logs
            </button>
          </div>

          {/* Refresh Button */}
          <div className="pt-6">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-900"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-400">Error: {error}</p>
        </div>
      )}

      {/* Log Display */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Activity Logs {logs.length > 0 && `(${logs.length})`}
            </h3>
            {!autoScroll && (
              <button
                onClick={() => setAutoScroll(true)}
                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Jump to bottom
              </button>
            )}
          </div>
        </div>

        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="h-[600px] overflow-y-auto font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
              No logs to display
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    log.level === 'stderr' ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">{formatTime(log.timestamp)}</span>
                    {getLevelBadge(log.level)}
                    {getCategoryBadge(log.category)}
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
                    {log.message}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
