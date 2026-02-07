"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface BandwidthDataPoint {
  timestamp: string;
  downloadRate: number;
  uploadRate: number;
}

interface BandwidthChartProps {
  hours?: number;
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

export function BandwidthChart({ hours = 24 }: BandwidthChartProps) {
  const [data, setData] = useState<BandwidthDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/bandwidth/history?hours=${hours}`);
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

    // Refresh every 60 seconds for hourly data
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [hours]);

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

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {formatTooltipTime(payload[0].payload.timestamp)}
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Download:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatBytesPerSecond(payload[0].value)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Upload:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatBytesPerSecond(payload[1].value)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

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
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-gray-500 dark:text-gray-400"
            stroke="currentColor"
          />
          <YAxis
            tickFormatter={(value) => formatBytesPerSecond(value)}
            tick={{ fontSize: 12, fill: 'currentColor' }}
            className="text-gray-500 dark:text-gray-400"
            stroke="currentColor"
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            iconType="circle"
            formatter={(value) => (
              <span className="text-gray-700 dark:text-gray-300">
                {value === 'downloadRate' ? 'Download' : 'Upload'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="downloadRate"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#colorDownload)"
            name="downloadRate"
          />
          <Area
            type="monotone"
            dataKey="uploadRate"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#colorUpload)"
            name="uploadRate"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
