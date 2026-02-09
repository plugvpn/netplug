"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Calendar, Database, User, Wifi, ArrowDownCircle, ArrowUpCircle, HardDrive, RefreshCw, AlertCircle } from "lucide-react";

// Helper function to format bytes
function formatBytes(bytes: string | number | bigint): string {
  const num = typeof bytes === 'string' || typeof bytes === 'bigint' ? Number(BigInt(bytes)) : bytes;
  const kb = num / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;
  const tb = gb / 1024;

  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  if (kb >= 1) return `${kb.toFixed(2)} KB`;
  return `${num.toFixed(0)} B`;
}

interface VPNUserStatus {
  user: {
    id: string;
    username: string;
    ipAddress: string;
    endpoint: string | null;
    remainingDays: number | null;
    remainingTrafficBytes: string | null;
    totalBytesReceived: string;
    totalBytesSent: string;
    isConnected: boolean;
    connectedAt: string | null;
    server: {
      name: string;
      protocol: string;
    };
  };
  detectedIP: string;
}

export default function StatusPage() {
  const [userStatus, setUserStatus] = useState<VPNUserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [publicIP, setPublicIP] = useState<string | null>(null);
  const [fetchingIP, setFetchingIP] = useState(false);

  const fetchPublicIP = async () => {
    if (fetchingIP) return;

    setFetchingIP(true);
    try {
      const response = await fetch('https://icanhazip.com');
      if (response.ok) {
        const ip = await response.text();
        setPublicIP(ip.trim());
      }
    } catch (err) {
      console.error('Failed to fetch public IP:', err);
    } finally {
      setFetchingIP(false);
    }
  };

  const fetchUserStatus = async () => {
    try {
      // Check if there's an IP parameter in the URL for testing
      const urlParams = new URLSearchParams(window.location.search);
      const testIp = urlParams.get('ip');
      const apiUrl = testIp ? `/api/users/by-ip?ip=${testIp}` : '/api/users/by-ip';

      const response = await fetch(apiUrl);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserStatus(data);
          setError(null);

          // Fetch public IP if user is connected
          if (data.user?.isConnected) {
            fetchPublicIP();
          }
        } else {
          setError('Unable to load status');
        }
      } else if (response.status === 404) {
        setError("You're not using NetPlug, Please connect to netplug first.");
      } else {
        setError('Failed to load status');
      }
    } catch (err) {
      console.error('Failed to fetch user status:', err);
      setError('Connection error');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserStatus();
    setRefreshing(false);
  };

  useEffect(() => {
    document.title = "VPN Status | NetPlug";
  }, []);

  useEffect(() => {
    async function initialFetch() {
      setLoading(true);
      await fetchUserStatus();
      setLoading(false);
    }

    initialFetch();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchUserStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Calculate remaining traffic percentage
  const getRemainingTrafficPercentage = () => {
    if (!userStatus?.user.remainingTrafficBytes) return 0;
    const remaining = Number(BigInt(userStatus.user.remainingTrafficBytes));
    const total = Number(BigInt(userStatus.user.totalBytesReceived)) + Number(BigInt(userStatus.user.totalBytesSent));
    if (total === 0) return 100;
    return Math.max(0, Math.min(100, (remaining / (remaining + total)) * 100));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your status...</p>
        </div>
      </div>
    );
  }

  if (error || !userStatus) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="rounded-lg border border-red-200 bg-white p-8 shadow-sm dark:border-red-800 dark:bg-gray-900 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Status Not Available
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error || 'Unable to load VPN status for your IP address'}
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Checking...' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/plug-icon.png"
                alt="NetPlug"
                width={56}
                height={56}
                className="rounded-full"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">NetPlug VPN Status</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Real-time connection and usage information
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:border-gray-500"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* VPN IP Banner - Fixed to bottom of header, only show when connected */}
        {userStatus?.user.isConnected && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 border-t border-emerald-200 dark:border-emerald-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
              <div className="flex items-center justify-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Your VPN IP:
                  {publicIP ? (
                    <span className="font-mono font-bold ml-1">{publicIP}</span>
                  ) : (
                    <span className="font-mono font-bold ml-1 animate-pulse">Loading...</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* User Info Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3 mb-6">
              <div className={`h-3 w-3 rounded-full ${userStatus.user.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {userStatus.user.isConnected ? 'Connected' : 'Disconnected'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Username</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{userStatus.user.username}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">VPN IP Address</div>
                  <div className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{userStatus.user.ipAddress}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Server</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {userStatus.user.server.name} ({userStatus.user.server.protocol.toUpperCase()})
                  </div>
                </div>
              </div>
              {userStatus.user.endpoint && (
                <div className="flex items-center gap-3">
                  <Wifi className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Connecting From</div>
                    <div className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                      {userStatus.user.endpoint.split(':')[0]}
                    </div>
                  </div>
                </div>
              )}
              {userStatus.user.connectedAt && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Connected Since</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {new Date(userStatus.user.connectedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unlimited Account Message - Show when both traffic and days are unlimited */}
          {(!userStatus.user.remainingTrafficBytes && !userStatus.user.remainingDays &&
            userStatus.user.remainingDays !== 0) ? (
            <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-8 shadow-sm dark:border-blue-800 dark:from-blue-900/20 dark:to-blue-800/20">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 dark:bg-blue-500/30 mb-4">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  You're Unlimited! 🎉
                </h3>
              </div>
            </div>
          ) : (
            <>
              {/* Remaining Traffic Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3 mb-6">
              <Database className="h-6 w-6 text-emerald-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Remaining Traffic</h2>
            </div>

            {userStatus.user.remainingTrafficBytes ? (
              <>
                {/* Large Remaining Amount */}
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    {formatBytes(userStatus.user.remainingTrafficBytes)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    remaining
                  </div>
                </div>

                {/* Traffic Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <span>Used</span>
                    <span>{getRemainingTrafficPercentage().toFixed(0)}% remaining</span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${getRemainingTrafficPercentage()}%` }}
                    />
                  </div>
                </div>

                {/* Traffic Stats - Horizontal Layout */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="text-center">
                    <ArrowDownCircle className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Downloaded</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatBytes(userStatus.user.totalBytesReceived)}
                    </div>
                  </div>
                  <div className="text-center">
                    <ArrowUpCircle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uploaded</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatBytes(userStatus.user.totalBytesSent)}
                    </div>
                  </div>
                  <div className="text-center">
                    <HardDrive className="h-5 w-5 text-purple-500 mx-auto mb-2" />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Used</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatBytes(
                        Number(BigInt(userStatus.user.totalBytesReceived)) +
                        Number(BigInt(userStatus.user.totalBytesSent))
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">Unlimited traffic</p>
              </div>
            )}
          </div>

          {/* Remaining Days Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="h-6 w-6 text-emerald-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Remaining Days</h2>
            </div>

            {userStatus.user.remainingDays !== null && userStatus.user.remainingDays !== undefined ? (
              <div className="text-center py-6">
                <div className="text-6xl font-bold text-emerald-600 dark:text-emerald-500 mb-2">
                  {userStatus.user.remainingDays}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  {userStatus.user.remainingDays === 1 ? 'day' : 'days'} remaining
                </div>
                {userStatus.user.remainingDays <= 7 && userStatus.user.remainingDays > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-400">
                      Your account will expire soon. Please contact support to renew.
                    </p>
                  </div>
                )}
                {userStatus.user.remainingDays <= 0 && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-400">
                      Your account has expired. Please contact support to renew.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No expiration date</p>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Auto-refreshes every 10 seconds</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
