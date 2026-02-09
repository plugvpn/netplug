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

  // Get level badge styling - Grafana style
  const getLevelBadge = (level: string) => {
    if (level === 'stderr') {
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
          ERROR
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
        INFO
      </span>
    );
  };

  // Get category badge styling - Grafana style
  const getCategoryBadge = (category?: string) => {
    if (!category) return null;

    const colors: Record<string, string> = {
      Startup: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      WireGuard: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      API: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      LogCapture: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      Database: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };

    const colorClass = colors[category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

    return (
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${colorClass}`}
      >
        {category}
      </span>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 shadow-lg">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-3 text-sm text-gray-400">Loading activity logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Stats Bar - Grafana Style */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 flex-shrink-0">
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-lg">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Logs</div>
            <div className="mt-2 text-2xl font-semibold text-gray-100">{stats.total}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-lg">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Info</div>
            <div className="mt-2 text-2xl font-semibold text-blue-400">{stats.stdout}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-lg">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Errors</div>
            <div className="mt-2 text-2xl font-semibold text-red-400">{stats.stderr}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-lg">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Categories</div>
            <div className="mt-2 text-2xl font-semibold text-gray-100">
              {stats.categories.length}
            </div>
          </div>
        </div>
      )}

      {/* Controls - Grafana Style */}
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 flex-shrink-0 shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          {/* Level Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="stdout">Info</option>
              <option value="stderr">Errors</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <div className="peer h-6 w-11 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-600 after:bg-gray-400 after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500"></div>
              <span className="ml-3 text-sm font-medium text-gray-300">Auto-refresh</span>
            </label>
          </div>

          {/* Clear Button */}
          <div className="pt-6">
            <button
              onClick={clearLogs}
              className="rounded bg-red-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            >
              Clear Logs
            </button>
          </div>

          {/* Refresh Button */}
          <div className="pt-6">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="rounded bg-blue-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message - Grafana Style */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-4 flex-shrink-0 shadow-lg">
          <p className="text-sm text-red-400 font-medium">Error: {error}</p>
        </div>
      )}

      {/* Log Display - Grafana Style */}
      <div className="rounded-lg border border-gray-700 bg-gray-900 flex-1 flex flex-col min-h-0 shadow-lg">
        <div className="border-b border-gray-700 px-4 py-3 flex-shrink-0 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-200">
              Activity Logs {logs.length > 0 && <span className="text-gray-400">({logs.length})</span>}
            </h3>
            {!autoScroll && (
              <button
                onClick={() => setAutoScroll(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Jump to bottom
              </button>
            )}
          </div>
        </div>

        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto font-mono text-xs bg-gray-950"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              No logs to display
            </div>
          ) : (
            <div>
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`px-4 py-2 border-l-2 hover:bg-gray-900/50 transition-colors ${
                    log.level === 'stderr'
                      ? 'border-l-red-500 bg-red-950/20'
                      : 'border-l-transparent hover:border-l-blue-500/30'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-gray-500 text-[11px]">{formatTime(log.timestamp)}</span>
                    {getLevelBadge(log.level)}
                    {getCategoryBadge(log.category)}
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-gray-300 leading-relaxed">
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
