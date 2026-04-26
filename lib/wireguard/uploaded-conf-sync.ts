import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { getPrimarySystemConfig } from '@/lib/setup'

/** Safe single-line value after `# User:` in wg0.conf (WireGuard treats # as comment). */
export function sanitizeUsernameForWgCommentFile(username: string): string {
  const t = username.replace(/[\r\n#]/g, '_').trim()
  return t.length > 0 ? t : 'user'
}

function splitInterfaceAndPeers(raw: string): { interfacePart: string; hadPeers: boolean } {
  const lines = raw.split(/\r?\n/)
  const peerIdx = lines.findIndex((l) => /^\s*\[Peer\]\s*$/i.test(l))
  if (peerIdx === -1) {
    return { interfacePart: raw.replace(/\s+$/, ''), hadPeers: false }
  }
  const interfacePart = trimTrailingPeerIntroComments(
    lines.slice(0, peerIdx).join('\n').replace(/\s+$/, '')
  )
  return { interfacePart, hadPeers: true }
}

function trimTrailingPeerIntroComments(interfacePart: string): string {
  const lines = interfacePart.split(/\r?\n/)
  let end = lines.length
  while (end > 0) {
    const line = lines[end - 1]
    const t = line.trim()
    if (t === '') {
      end -= 1
      continue
    }
    if (/^\s*#\s*User:\s*/i.test(line)) {
      end -= 1
      continue
    }
    if (/^\s*#\s*=+\s*Client Peers\s*=+\s*$/i.test(t)) {
      end -= 1
      continue
    }
    break
  }
  return lines.slice(0, end).join('\n').replace(/\s+$/, '')
}

function buildPeersBlock(
  users: Array<{
    username: string
    publicKey: string | null
    presharedKey: string | null
    allowedIps: string | null
  }>,
  persistentKeepalive: number
): string {
  const parts: string[] = ['# ========== Client Peers ==========', '']

  for (const user of users) {
    if (!user.allowedIps || !user.publicKey) continue

    parts.push(`# User: ${sanitizeUsernameForWgCommentFile(user.username)}`)
    parts.push('[Peer]')
    parts.push(`PublicKey = ${user.publicKey}`)
    if (user.presharedKey) {
      parts.push(`PresharedKey = ${user.presharedKey}`)
    }
    parts.push(`AllowedIPs = ${user.allowedIps}`)
    if (persistentKeepalive > 0) {
      parts.push(`PersistentKeepalive = ${persistentKeepalive}`)
    }
    parts.push('')
  }

  return parts.join('\n').replace(/\s+$/, '')
}

/**
 * For uploaded wg0.conf mode: rewrite only the [Peer] sections from DB-enabled users,
 * preserving the [Interface] block. Adds `# User: <username>` before each peer.
 */
export async function syncUploadedWgConfPeersFromDatabase(): Promise<boolean> {
  const dataDir = process.env.DATA_DIR
  if (!dataDir) {
    console.error('[WireGuard] DATA_DIR is not set; cannot sync uploaded wg0.conf')
    return false
  }

  const systemConfig = await getPrimarySystemConfig()
  const wg = (systemConfig?.vpnConfiguration as Record<string, unknown> | null)?.wireGuard as
    | { persistentKeepalive?: number }
    | undefined
  const persistentKeepalive =
    typeof wg?.persistentKeepalive === 'number' && !isNaN(wg.persistentKeepalive)
      ? wg.persistentKeepalive
      : 25

  const server = await prisma.vPNServer.findFirst({
    where: { protocol: 'wireguard', isActive: true },
  })
  const configPath =
    server?.configPath && server.configPath.length > 0
      ? server.configPath
      : path.join(dataDir, 'wg0.conf')

  let raw: string
  try {
    raw = await fs.readFile(configPath, 'utf-8')
  } catch {
    console.error(`[WireGuard] Cannot read wg0.conf for uploaded sync: ${configPath}`)
    return false
  }

  const { interfacePart } = splitInterfaceAndPeers(raw)

  const users = await prisma.vPNUser.findMany({
    where: {
      isEnabled: true,
      ...(server ? { serverId: server.id } : {}),
      server: { protocol: 'wireguard', isActive: true },
    },
    include: { server: true },
    orderBy: { createdAt: 'asc' },
  })

  const wgUsers = users.filter((u) => u.server.protocol === 'wireguard')
  const eligible = wgUsers.filter((u) => Boolean(u.allowedIps && u.publicKey))

  if (eligible.length === 0) {
    const out = `${interfacePart}\n`
    await fs.writeFile(configPath, out, 'utf-8')
    await fs.chmod(configPath, 0o600)
    console.log(`[WireGuard] Cleared peers in uploaded wg0.conf (no enabled users): ${configPath}`)
    return true
  }

  const peerBody = buildPeersBlock(eligible, persistentKeepalive)
  const out =
    peerBody.length > 0
      ? `${interfacePart}\n\n${peerBody}\n`
      : `${interfacePart}\n`

  await fs.writeFile(configPath, out, 'utf-8')
  await fs.chmod(configPath, 0o600)
  console.log(`[WireGuard] Synced ${eligible.length} peer(s) into uploaded wg0.conf: ${configPath}`)
  return true
}
