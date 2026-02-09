import { NextResponse } from 'next/server';
import { reloadWireGuardConfig } from '@/lib/wireguard/sync-service';
import { requireAuth } from '@/lib/api-auth';

export async function POST() {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    const success = await reloadWireGuardConfig('wg0');

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'WireGuard configuration reloaded successfully',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to reload WireGuard configuration',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error reloading WireGuard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
