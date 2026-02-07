import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Get all WireGuard interfaces
    const { stdout } = await execAsync('wg show interfaces');
    const interfaces = stdout.trim().split(/\s+/).filter(i => i);

    if (interfaces.length === 0) {
      return NextResponse.json({
        found: false,
        message: 'No WireGuard interfaces found',
      });
    }

    // Get detailed info for each interface
    const interfaceDetails = await Promise.all(
      interfaces.map(async (iface) => {
        try {
          const { stdout: showOutput } = await execAsync(`wg show ${iface}`);
          return {
            name: iface,
            details: showOutput,
          };
        } catch (error) {
          return {
            name: iface,
            error: 'Failed to get details',
          };
        }
      })
    );

    return NextResponse.json({
      found: true,
      interfaces: interfaceDetails,
      primary: interfaces[0], // First interface is considered primary
    });
  } catch (error: any) {
    console.error('Error getting WireGuard interfaces:', error);
    return NextResponse.json(
      {
        found: false,
        error: error.message || 'Failed to get WireGuard interfaces',
      },
      { status: 500 }
    );
  }
}
