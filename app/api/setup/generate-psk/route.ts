import { NextResponse } from 'next/server'
import { generatePresharedKey } from '@/lib/wireguard/key-generator'

export async function POST() {
  try {
    const presharedKey = generatePresharedKey()

    return NextResponse.json({
      presharedKey,
    })
  } catch (error) {
    console.error('Error generating preshared key:', error)
    return NextResponse.json(
      { error: 'Failed to generate preshared key. Ensure WireGuard tools are installed.' },
      { status: 500 }
    )
  }
}
