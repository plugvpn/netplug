"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ActivityLog } from "@/components/activity-log";

export default function ActivityPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.title = "Activity | NetPlug Dashboard";
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshKey(prev => prev + 1);
    // Small delay for visual feedback
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader title="Activity">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded border border-gray-300 px-4 py-1.5 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:border-gray-500"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </PageHeader>
      <div className="flex-1 overflow-hidden">
        <div className="p-8 h-full">
          <ActivityLog key={refreshKey} />
        </div>
      </div>
    </div>
  );
}
