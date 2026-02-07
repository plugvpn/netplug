import { NextResponse } from 'next/server'
import { generateWireGuardKeyPair } from '@/lib/wireguard/key-generator'

export async function POST() {
  try {
    const keyPair = generateWireGuardKeyPair()

    return NextResponse.json({
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    })
  } catch (error) {
    console.error('Error generating WireGuard keys:', error)
    return NextResponse.json(
      { error: 'Failed to generate WireGuard keys. Ensure WireGuard tools are installed.' },
      { status: 500 }
    )
  }
}
