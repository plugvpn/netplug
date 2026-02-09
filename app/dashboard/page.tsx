"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Info, ArrowDownCircle, ArrowUpCircle, HardDrive, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { BandwidthChart } from "@/components/bandwidth-chart";

// Helper function to format bytes
function formatBytes(bytes: string): string {
  const num = Number(BigInt(bytes));
  const kb = num / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;
  const tb = gb / 1024;

  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  if (kb >= 1) return `${kb.toFixed(2)} KB`;
  return `${bytes} B`;
}

interface SystemInfo {
  serverAddress: string;
  version: string;
  osName: string;
  hostname: string;
  acceptingConnectionsOn: string;
  ports: string;
}

interface ConnectionStats {
  inUse: number;
  available: number;
  total: number;
  disabled: number;
}

interface DataTransferStats {
  total: {
    received: string;
    sent: string;
    combined: string;
  };
}

export default function DashboardPage() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);
  const [dataTransferStats, setDataTransferStats] = useState<DataTransferStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [systemResponse, connectionResponse, dataTransferResponse] = await Promise.all([
        fetch('/api/system/info'),
        fetch('/api/connections/stats'),
        fetch('/api/connections/data-transfer'),
      ]);

      if (systemResponse.ok) {
        const data = await systemResponse.json();
        setSystemInfo(data);
      }

      if (connectionResponse.ok) {
        const data = await connectionResponse.json();
        setConnectionStats(data);
      }

      if (dataTransferResponse.ok) {
        const data = await dataTransferResponse.json();
        setDataTransferStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    document.title = "Overview | NetPlug Dashboard";
  }, []);

  useEffect(() => {
    async function initialFetch() {
      setLoading(true);
      await fetchData();
      setLoading(false);
    }

    initialFetch();

    // Auto-refresh every 10 seconds (matches background sync frequency)
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <PageHeader title="Overview">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Synced from WireGuard every 10s</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded border border-gray-300 px-4 py-1.5 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:border-gray-500"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - 2/3 width */}
            <div className="space-y-6 lg:col-span-2">
          {/* Connections Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-normal text-gray-900 dark:text-gray-100">Connections</h2>
                <Info className="h-4 w-4 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
              </div>
              <Link
                href="/dashboard/connections"
                className="rounded border border-emerald-600 px-4 py-1.5 text-sm font-normal text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-500 dark:hover:bg-emerald-950"
              >
                View active connections
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-12 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            ) : connectionStats ? (
              <>
                {/* Connections Bar */}
                <div className="mb-4">
                  <div className="relative h-12 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                    {connectionStats.total > 0 && (
                      <>
                        {/* In use (green) */}
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 dark:from-emerald-500 dark:to-emerald-600"
                          style={{
                            width: `${(connectionStats.inUse / connectionStats.total) * 100}%`
                          }}
                        />
                        {/* Available (amber) */}
                        <div
                          className="absolute top-0 h-full bg-gradient-to-r from-amber-300 to-amber-400 dark:from-amber-500 dark:to-amber-600"
                          style={{
                            left: `${(connectionStats.inUse / connectionStats.total) * 100}%`,
                            width: `${(connectionStats.available / connectionStats.total) * 100}%`
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Scale */}
                <div className="mb-6 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>0</span>
                  {connectionStats.total > 1 && (
                    <span>{Math.floor(connectionStats.total / 2)}</span>
                  )}
                  <span>{connectionStats.total}</span>
                </div>

                {/* Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">In use (on this node)</span>
                    </div>
                    <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{connectionStats.inUse}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Available</span>
                    </div>
                    <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{connectionStats.available}</span>
                  </div>
                  <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Total</span>
                      <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{connectionStats.total}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Failed to load connection statistics
              </div>
            )}
          </div>

          {/* Data Transfer Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-normal text-gray-900 dark:text-gray-100">Data Transfer</h2>
                <Info className="h-4 w-4 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
              </div>
            </div>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            ) : dataTransferStats ? (
              <div className="space-y-4">
                {/* Bandwidth Chart */}
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
                  <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Bandwidth Over Time (This Month)</h3>
                  <BandwidthChart mode="daily" />
                </div>

                {/* Total Transfer Stats */}
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-gray-600 dark:text-gray-400" strokeWidth={1.5} />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Total Transfer (All Time)</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Downloaded</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatBytes(dataTransferStats.total.sent)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Uploaded</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatBytes(dataTransferStats.total.received)}
                      </span>
                    </div>
                    <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Total</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatBytes(dataTransferStats.total.combined)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Failed to load data transfer statistics
              </div>
            )}
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-6 text-base font-normal text-gray-900 dark:text-gray-100">Server Details</h2>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            ) : systemInfo ? (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Server address</span>
                  <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{systemInfo.serverAddress}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Access Server version</span>
                  <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{systemInfo.version}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Operating System</span>
                  <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{systemInfo.osName}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">OS hostname</span>
                  <span className="text-sm font-mono text-xs text-gray-900 dark:text-gray-100">{systemInfo.hostname}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Accepting connections on</span>
                  <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{systemInfo.acceptingConnectionsOn}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Port</span>
                  <span className="text-sm font-normal text-gray-900 dark:text-gray-100">{systemInfo.ports}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Failed to load server details
              </div>
            )}
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
