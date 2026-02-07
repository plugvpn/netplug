import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { privateKey } = body

    if (!privateKey) {
      return NextResponse.json(
        { error: 'Private key is required' },
        { status: 400 }
      )
    }

    // Derive public key from private key using wg pubkey
    try {
      const publicKey = execSync(`echo "${privateKey}" | wg pubkey`, {
        encoding: 'utf-8',
        shell: '/bin/bash',
      }).trim()

      return NextResponse.json({
        publicKey,
      })
    } catch (error) {
      console.error('Failed to derive public key using wg command:', error)
      return NextResponse.json(
        { error: 'Failed to derive public key. Invalid private key or WireGuard tools not installed.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error deriving public key:', error)
    return NextResponse.json(
      { error: 'Failed to derive public key' },
      { status: 500 }
    )
  }
}
