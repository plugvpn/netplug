"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface BandwidthDataPointHourly {
  timestamp: string;
  downloadRate: number;
  uploadRate: number;
}

interface BandwidthDataPointDaily {
  day: number;
  timestamp: string;
  downloadTotal: number;
  uploadTotal: number;
  combinedTotal: number;
}

type BandwidthDataPoint = BandwidthDataPointHourly | BandwidthDataPointDaily;

interface BandwidthChartProps {
  hours?: number;
  mode?: 'hourly' | 'daily';
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;
  const tb = gb / 1024;

  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  if (kb >= 1) return `${kb.toFixed(2)} KB`;
  return `${bytes.toFixed(0)} B`;
}

// Helper function to format bytes per second
function formatBytesPerSecond(bytesPerSec: number): string {
  const kb = bytesPerSec / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  if (gb >= 1) return `${gb.toFixed(2)} GB/s`;
  if (mb >= 1) return `${mb.toFixed(2)} MB/s`;
  if (kb >= 1) return `${kb.toFixed(2)} KB/s`;
  return `${bytesPerSec.toFixed(0)} B/s`;
}

// Helper function to format time (show hour for 24h view)
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    hour12: false
  });
}

// Helper function to format time in tooltip
function formatTooltipTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function BandwidthChart({ hours = 24, mode = 'hourly' }: BandwidthChartProps) {
  const [data, setData] = useState<BandwidthDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const url = mode === 'daily'
        ? '/api/bandwidth/history?mode=daily'
        : `/api/bandwidth/history?hours=${hours}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setData(result.history);
      }
    } catch (error) {
      console.error('Failed to fetch bandwidth history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [hours, mode]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading chart...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">No data available yet</div>
      </div>
    );
  }

  // Helper to format date for daily tooltip
  const formatDailyDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const today = new Date();

    // Check if it's today
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return 'Today';
    }

    // Format as "DD MMM" (e.g., "09 Feb")
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short'
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const isDaily = mode === 'daily';
      const dataPoint = payload[0].payload;

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {isDaily
              ? formatDailyDate(dataPoint.timestamp)
              : formatTooltipTime(dataPoint.timestamp)}
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Download:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {isDaily
                  ? formatBytes(payload[0].value)
                  : formatBytesPerSecond(payload[0].value)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Upload:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {isDaily
                  ? formatBytes(payload[1].value)
                  : formatBytesPerSecond(payload[1].value)}
              </span>
            </div>
            {isDaily && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Total:</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatBytes(dataPoint.combinedTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const isDaily = mode === 'daily';
  const downloadKey = isDaily ? 'downloadTotal' : 'downloadRate';
  const uploadKey = isDaily ? 'uploadTotal' : 'uploadRate';
  const xAxisKey = isDaily ? 'day' : 'timestamp';

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" opacity={0.5} />
          <XAxis
            dataKey={xAxisKey}
            tickFormatter={isDaily ? undefined : formatTime}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            className="text-gray-400 dark:text-gray-500"
            stroke="#d1d5db"
            label={isDaily ? { value: 'Day of Month', position: 'insideBottom', offset: -5, fill: '#9ca3af' } : undefined}
          />
          <YAxis
            tickFormatter={(value) => isDaily ? formatBytes(value) : formatBytesPerSecond(value)}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            className="text-gray-400 dark:text-gray-500"
            stroke="#d1d5db"
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            iconType="circle"
            formatter={(value) => (
              <span className="text-gray-500 dark:text-gray-400">
                {value === downloadKey ? 'Download' : 'Upload'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey={downloadKey}
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#colorDownload)"
            name={downloadKey}
          />
          <Area
            type="monotone"
            dataKey={uploadKey}
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#colorUpload)"
            name={uploadKey}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
