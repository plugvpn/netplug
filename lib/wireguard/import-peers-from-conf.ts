import type { ParsedWgPeer } from '@/lib/wireguard/parse-wg-conf'
import { normalizeIpList } from '@/lib/allowed-ips'
import { isIpInRange, isValidIPAddress } from '@/lib/utils/ip-allocation'

export type PreparedImportedVpnUser = {
  username: string
  allowedIps: string
  publicKey: string
  presharedKey: string | null
}

function ensureCidrEntry(entry: string): string | null {
  const t = entry.trim()
  if (!t) return null
  if (t.includes('/')) return t
  if (isValidIPAddress(t)) return `${t}/32`
  return t
}

/** Comma-separated AllowedIPs line → DB-ready comma-separated CIDR list. */
export function normalizedAllowedIpsForDb(allowedIPsLine: string | undefined): string | null {
  if (!allowedIPsLine?.trim()) return null
  const parts = normalizeIpList(allowedIPsLine.replace(/\s*,\s*/g, ','))
  const out: string[] = []
  for (const p of parts) {
    const c = ensureCidrEntry(p)
    if (c) out.push(c)
  }
  return out.length ? out.join(',') : null
}

/**
 * Prefer the tunnel IPv4 inside the VPN client subnet; else first IPv4 host in the list.
 */
export function vpnIpHostForUsername(
  allowedIPsLine: string | undefined,
  clientAddressRange: string
): string | null {
  if (!allowedIPsLine?.trim()) return null
  const entries = normalizeIpList(allowedIPsLine.replace(/\s*,\s*/g, ','))

  for (const cidr of entries) {
    const slash = cidr.indexOf('/')
    const host = slash === -1 ? cidr : cidr.slice(0, slash)
    if (!isValidIPAddress(host)) continue
    if (isIpInRange(host, clientAddressRange)) return host
  }

  for (const cidr of entries) {
    const slash = cidr.indexOf('/')
    const host = slash === -1 ? cidr : cidr.slice(0, slash)
    if (isValidIPAddress(host)) return host
  }

  return null
}

function pubkeySuffix(publicKey: string) {
  return publicKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
}

function allocateUsername(base: string, used: Set<string>): string {
  let candidate = base
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base}-${n}`
    n += 1
  }
  used.add(candidate)
  return candidate
}

/** Normalize `# User:` label from wg0.conf for use as dashboard username. */
export function sanitizeUsernameFromImportedWgComment(raw: string): string | null {
  let t = raw.replace(/[\r\n#]/g, '').trim()
  if (!t) return null
  t = t.replace(/\s+/g, '_').slice(0, 128)
  t = t.replace(/[^a-zA-Z0-9_.@-]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return t.length ? t : null
}

/**
 * True when the line after `# User:` is empty or a doc placeholder (not a real name).
 * In those cases the importer should use the peer VPN IP as username.
 */
export function isPlaceholderUserComment(raw: string): boolean {
  const t = raw.trim()
  if (!t) return true
  if (/^<\s*username\s*>$/i.test(t)) return true
  if (/^<\s*user\s*>$/i.test(t)) return true
  if (/^<\s*name\s*>$/i.test(t)) return true
  return false
}

export function uniqueUsernameForPeer(
  primaryLabel: string | null,
  publicKey: string,
  used: Set<string>
): string {
  const base =
    primaryLabel && primaryLabel.length > 0
      ? primaryLabel
      : `peer-${pubkeySuffix(publicKey)}`
  return allocateUsername(base, used)
}

/**
 * Build dashboard VPN users from wg-quick [Peer] blocks (server config).
 * Skips peers without AllowedIPs, without a resolvable public key, or matching the server public key.
 */
export function prepareImportedVpnUsers(
  peers: ParsedWgPeer[],
  clientAddressRange: string,
  serverWireGuardPublicKey: string
): { users: PreparedImportedVpnUser[]; skipped: number } {
  const users: PreparedImportedVpnUser[] = []
  let skipped = 0
  const usedNames = new Set<string>()

  for (const peer of peers) {
    if (!peer.publicKey?.trim()) {
      skipped += 1
      continue
    }
    if (peer.publicKey.trim() === serverWireGuardPublicKey.trim()) {
      skipped += 1
      continue
    }
    const allowedIps = normalizedAllowedIpsForDb(peer.allowedIPs)
    if (!allowedIps) {
      skipped += 1
      continue
    }
    const rawComment = peer.userComment?.trim() ?? ''
    const vpnHost = vpnIpHostForUsername(peer.allowedIPs, clientAddressRange)

    let fromComment: string | null = null
    if (rawComment && !isPlaceholderUserComment(rawComment)) {
      fromComment = sanitizeUsernameFromImportedWgComment(peer.userComment!)
    }

    const username = uniqueUsernameForPeer(
      fromComment || vpnHost,
      peer.publicKey,
      usedNames
    )

    users.push({
      username,
      allowedIps,
      publicKey: peer.publicKey.trim(),
      presharedKey: peer.presharedKey?.trim() || null,
    })
  }

  return { users, skipped }
}
