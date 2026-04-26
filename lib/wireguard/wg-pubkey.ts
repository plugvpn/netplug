import { spawn } from 'child_process'

/**
 * Derive a WireGuard public key from a private key using `wg pubkey` (stdin).
 */
export function wgPubkeyFromPrivate(privateKey: string): Promise<string> {
  const trimmed = privateKey.trim()
  if (!trimmed) {
    return Promise.reject(new Error('Private key is empty'))
  }

  return new Promise((resolve, reject) => {
    const child = spawn('wg', ['pubkey'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `wg pubkey exited with code ${code}`))
        return
      }
      const out = stdout.trim()
      if (!out) {
        reject(new Error('wg pubkey returned empty output'))
        return
      }
      resolve(out)
    })

    child.stdin.write(`${trimmed}\n`)
    child.stdin.end()
  })
}
