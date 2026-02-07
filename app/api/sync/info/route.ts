import { NextResponse } from 'next/server';

// Store last sync time in memory (resets on server restart)
let lastSyncTime: Date | null = null;
let lastSyncStatus: 'success' | 'error' = 'success';
let lastSyncError: string | null = null;

export function updateSyncInfo(status: 'success' | 'error', error?: string) {
  lastSyncTime = new Date();
  lastSyncStatus = status;
  lastSyncError = error || null;
}

export async function GET() {
  return NextResponse.json({
    lastSync: lastSyncTime?.toISOString() || null,
    status: lastSyncStatus,
    error: lastSyncError,
    syncInterval: '10 seconds',
    dashboardRefresh: '10 seconds',
    timeSinceLastSync: lastSyncTime
      ? Math.floor((Date.now() - lastSyncTime.getTime()) / 1000)
      : null,
  });
}
