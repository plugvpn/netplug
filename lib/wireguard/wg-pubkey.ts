import { execFile } from 'node:child_process/promises'

/**
 * Derive a WireGuard public key from a private key using `wg pubkey` (stdin).
 */
export async function wgPubkeyFromPrivate(privateKey: string): Promise<string> {
  const trimmed = privateKey.trim()
  if (!trimmed) {
    throw new Error('Private key is empty')
  }
  const { stdout } = await execFile('wg', ['pubkey'], {
    input: `${trimmed}\n`,
    maxBuffer: 64 * 1024,
  })
  const out = stdout.trim()
  if (!out) {
    throw new Error('wg pubkey returned empty output')
  }
  return out
}
