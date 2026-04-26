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

function stripCommentForKeyLine(line: string): string {
  const hash = line.indexOf('#')
  if (hash === -1) return line.trimEnd()
  return line.slice(0, hash).trim()
}

function lineKey(line: string): string | null {
  const s = stripCommentForKeyLine(line)
  if (!s) return null
  const eq = s.indexOf('=')
  if (eq === -1) return null
  return s.slice(0, eq).trim().toLowerCase()
}

/**
 * Apply dashboard WireGuard settings to the [Interface] section while preserving
 * PrivateKey and any other keys (FwMark, PreUp, comments, etc.).
 */
export function applyDashboardToUploadedInterfacePart(
  interfacePart: string,
  wg: {
    serverAddress: string
    clientAddressRange: string
    serverPort: number
    mtu: number
    preUp?: string
    preDown?: string
    postUp?: string
    postDown?: string
  },
): string {
  let serverAddress = String(wg.serverAddress ?? '').trim()
  if (serverAddress && !serverAddress.includes('/')) {
    const cr = String(wg.clientAddressRange ?? '')
    const cidr = cr.includes('/') ? cr.substring(cr.indexOf('/')) : '/24'
    serverAddress = `${serverAddress}${cidr}`
  }

  const lines = interfacePart.split(/\r?\n/)
  const ifaceHeaderIdx = lines.findIndex((l) => /^\s*\[Interface\]\s*$/i.test(l.trim()))
  if (ifaceHeaderIdx === -1) {
    return interfacePart
  }

  let ifaceEnd = lines.length
  for (let j = ifaceHeaderIdx + 1; j < lines.length; j++) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[j].trim())) {
      ifaceEnd = j
      break
    }
  }

  const before = lines.slice(0, ifaceHeaderIdx)
  const ifaceHeader = lines[ifaceHeaderIdx]
  const inner = lines.slice(ifaceHeaderIdx + 1, ifaceEnd)
  const after = lines.slice(ifaceEnd)

  const desired: Record<string, string> = {}
  if (serverAddress) {
    desired.address = `Address = ${serverAddress}`
  }
  desired.listenport = `ListenPort = ${wg.serverPort}`
  desired.mtu = `MTU = ${wg.mtu}`
  const preUp = typeof wg.preUp === 'string' ? wg.preUp.trim() : ''
  const preDown = typeof wg.preDown === 'string' ? wg.preDown.trim() : ''
  const postUp = typeof wg.postUp === 'string' ? wg.postUp.trim() : ''
  const postDown = typeof wg.postDown === 'string' ? wg.postDown.trim() : ''
  if (preUp) {
    desired.preup = `PreUp = ${preUp}`
  }
  if (postUp) {
    desired.postup = `PostUp = ${postUp}`
  }
  if (preDown) {
    desired.predown = `PreDown = ${preDown}`
  }
  if (postDown) {
    desired.postdown = `PostDown = ${postDown}`
  }

  const seen = new Set<string>()
  const newInner: string[] = []
  for (const line of inner) {
    const k = lineKey(line)
    if (k && Object.prototype.hasOwnProperty.call(desired, k)) {
      newInner.push(desired[k]!)
      seen.add(k)
    } else if (k === 'preup' && !Object.prototype.hasOwnProperty.call(desired, 'preup')) {
      // cleared in dashboard
    } else if (k === 'predown' && !Object.prototype.hasOwnProperty.call(desired, 'predown')) {
      // cleared in dashboard
    } else if (k === 'postup' && !Object.prototype.hasOwnProperty.call(desired, 'postup')) {
      // cleared in dashboard
    } else if (k === 'postdown' && !Object.prototype.hasOwnProperty.call(desired, 'postdown')) {
      // cleared in dashboard
    } else {
      newInner.push(line)
    }
  }
  for (const k of Object.keys(desired)) {
    if (!seen.has(k)) {
      newInner.push(desired[k]!)
    }
  }

  return [...before, ifaceHeader, ...newInner, ...after].join('\n')
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
    | {
        persistentKeepalive?: number
        serverAddress?: string
        clientAddressRange?: string
        serverPort?: number
        mtu?: number
        preUp?: string
        preDown?: string
        postUp?: string
        postDown?: string
      }
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

  let { interfacePart } = splitInterfaceAndPeers(raw)
  if (wg) {
    const serverPort =
      typeof wg.serverPort === 'number' && !isNaN(wg.serverPort) && wg.serverPort >= 1 && wg.serverPort <= 65535
        ? wg.serverPort
        : 51820
    const mtu = typeof wg.mtu === 'number' && !isNaN(wg.mtu) && wg.mtu > 0 ? wg.mtu : 1420
    interfacePart = applyDashboardToUploadedInterfacePart(interfacePart, {
      serverAddress: String(wg.serverAddress ?? ''),
      clientAddressRange: String(wg.clientAddressRange ?? ''),
      serverPort,
      mtu,
      preUp: typeof wg.preUp === 'string' ? wg.preUp : undefined,
      preDown: typeof wg.preDown === 'string' ? wg.preDown : undefined,
      postUp: typeof wg.postUp === 'string' ? wg.postUp : undefined,
      postDown: typeof wg.postDown === 'string' ? wg.postDown : undefined,
    })
  }

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
