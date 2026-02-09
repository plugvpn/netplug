import { NextResponse } from 'next/server';
import { syncWireGuardStatus } from '@/lib/wireguard/sync-service';
import { requireAuth } from '@/lib/api-auth';

/**
 * Manually trigger WireGuard sync
 * Useful for testing or forcing an immediate sync
 */
export async function POST() {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    console.log('[API] Manual WireGuard sync triggered');
    await syncWireGuardStatus('wg0');

    return NextResponse.json({
      success: true,
      message: 'WireGuard status synced successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Error syncing WireGuard:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync WireGuard status',
      },
      { status: 500 }
    );
  }
}

/**
 * Get information about the sync configuration
 */
export async function GET() {
  try {
    // Fixed timeout of 2 minutes (120 seconds)
    const timeoutSeconds = 120;

    return NextResponse.json({
      syncInterval: '10 seconds',
      timeoutThreshold: `${timeoutSeconds} seconds (2 minutes)`,
      calculation: {
        timeout: timeoutSeconds,
      },
      notes: [
        'User is online if last handshake was within 2 minutes',
        'User is offline if last handshake exceeds 2 minutes',
        'Sync runs automatically every 10 seconds in background',
        'Use POST /api/wireguard/sync to manually trigger sync',
      ],
    });
  } catch (error: any) {
    console.error('[API] Error getting sync info:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get sync information',
      },
      { status: 500 }
    );
  }
}
