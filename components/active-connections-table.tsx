"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, HardDrive } from "lucide-react";

interface ActiveConnection {
  id: string;
  username: string;
  ipAddress: string;
  endpoint: string | null;
  lastHandshake: string | null;
  bytesReceived: string;
  bytesSent: string;
  serverName: string;
  protocol: string;
  serverHost: string;
  serverPort: number | null;
}

function formatBytes(bytes: string): string {
  const num = BigInt(bytes);
  const kb = Number(num) / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  if (kb >= 1) return `${kb.toFixed(2)} KB`;
  return `${bytes} B`;
}

function formatLastHandshake(lastHandshake: string | null): string {
  if (!lastHandshake) return 'N/A';

  const now = new Date();
  const handshake = new Date(lastHandshake);
  const diffMs = now.getTime() - handshake.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s ago`;
  }
  return `${seconds}s ago`;
}

export function ActiveConnectionsTable() {
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConnections() {
      try {
        const response = await fetch('/api/connections/active');
        if (response.ok) {
          const data = await response.json();
          setConnections(data);
        }
      } catch (error) {
        console.error('Failed to fetch active connections:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchConnections();

    // Refresh every 10 seconds (matches dashboard refresh)
    const interval = setInterval(fetchConnections, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center text-center">
          <Activity className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" strokeWidth={1.5} />
          <h3 className="text-lg font-normal text-gray-900 dark:text-gray-100 mb-2">
            No Active Connections
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            There are currently no users connected to the VPN servers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Public IP
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Server
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Handshake
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Usage
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {connections.map((connection) => (
              <tr
                key={connection.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {connection.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-normal text-gray-900 dark:text-gray-100">
                        {connection.username}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                    {connection.endpoint || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {connection.serverName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {connection.protocol.toUpperCase()}
                    {connection.serverPort && ` • Port ${connection.serverPort}`}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900 dark:text-gray-100">
                    <Clock className="h-4 w-4 mr-2 text-gray-400" strokeWidth={1.5} />
                    {formatLastHandshake(connection.lastHandshake)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center text-sm">
                      <HardDrive className="h-4 w-4 mr-1 text-blue-500" strokeWidth={1.5} />
                      <span className="text-gray-500 dark:text-gray-400 text-xs mr-1">↓</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {formatBytes(connection.bytesSent)}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400 text-xs mr-1">↑</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {formatBytes(connection.bytesReceived)}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 border-t border-gray-200 dark:border-gray-800">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{connections.length}</span> active {connections.length === 1 ? 'connection' : 'connections'}
        </div>
      </div>
    </div>
  );
}
