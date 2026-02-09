import { NextResponse } from 'next/server';
import { bringDownWireGuard, bringUpWireGuard } from '@/lib/wireguard/sync-service';
import { writeWireGuardConfig } from '@/lib/wireguard/config-generator';
import { requireAuth } from '@/lib/api-auth';

export async function POST() {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  try {
    // Generate config
    const generated = await writeWireGuardConfig();
    if (!generated) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate WireGuard configuration',
        },
        { status: 500 }
      );
    }

    // Bring down interface
    await bringDownWireGuard('wg0');

    // Bring up interface
    const success = await bringUpWireGuard('wg0');

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'WireGuard interface restarted successfully',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to bring up WireGuard interface',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error restarting WireGuard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
