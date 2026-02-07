import { NextResponse } from 'next/server';
import { getWireGuardStatus } from '@/lib/wireguard/sync-service';

export async function GET() {
  try {
    const status = await getWireGuardStatus('wg0');

    if (!status) {
      return NextResponse.json(
        {
          error: 'Unable to get WireGuard status. Check if WireGuard is installed and interface exists.',
        },
        { status: 503 }
      );
    }

    // Convert BigInt to string for JSON serialization
    const serializedStatus = {
      ...status,
      peers: status.peers.map(peer => ({
        ...peer,
        transferRx: peer.transferRx.toString(),
        transferTx: peer.transferTx.toString(),
      })),
    };

    return NextResponse.json(serializedStatus);
  } catch (error) {
    console.error('Error getting WireGuard status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get WireGuard status',
      },
      { status: 500 }
    );
  }
}
