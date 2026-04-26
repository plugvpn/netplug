export interface ParsedWgInterface {
  privateKey: string
  listenPort: number
  addressRaw: string
  mtu?: number
  dns?: string
  postUp?: string
  postDown?: string
  fwMark?: number
}

export interface ParsedWgPeer {
  publicKey: string
  allowedIPs?: string
  presharedKey?: string
  persistentKeepalive?: number
  /** From `# User: ...` on the line(s) immediately before this [Peer] (may follow the prior peer's keys). */
  userComment?: string
}

export interface ParsedWgServerConf {
  interface: ParsedWgInterface
  peers: ParsedWgPeer[]
}

function stripComment(line: string): string {
  const hash = line.indexOf('#')
  if (hash === -1) return line.trim()
  return line.slice(0, hash).trim()
}

function parseKeyValue(line: string): [string, string] | null {
  const eq = line.indexOf('=')
  if (eq === -1) return null
  const key = line.slice(0, eq).trim()
  const value = line.slice(eq + 1).trim()
  if (!key) return null
  return [key, value]
}

/**
 * Parse a wg-quick style server config ([Interface] + [Peer] sections).
 */
export function parseWgQuickServerConf(content: string): ParsedWgServerConf {
  const lines = content.split(/\r?\n/)
  let section: 'none' | 'interface' | 'peer' = 'none'
  const iface: Partial<ParsedWgInterface> & { privateKey?: string; addressRaw?: string } = {}
  const peers: ParsedWgPeer[] = []
  let currentPeer: Partial<ParsedWgPeer> | null = null
  let pendingUserComment: string | undefined

  const flushPeer = () => {
    if (currentPeer?.publicKey) {
      peers.push({
        publicKey: currentPeer.publicKey,
        allowedIPs: currentPeer.allowedIPs,
        presharedKey: currentPeer.presharedKey,
        persistentKeepalive: currentPeer.persistentKeepalive,
        userComment: currentPeer.userComment,
      })
    }
    currentPeer = null
  }

  for (const raw of lines) {
    const trimmedStart = raw.trimStart()
    if (trimmedStart.startsWith('#')) {
      // Apply to the next [Peer], even if it appears after the previous peer's fields
      // (we stay in section === 'peer' until the next [Peer] line).
      const userMatch = raw.match(/^\s*#\s*User:\s*(.+?)\s*$/)
      if (userMatch) {
        pendingUserComment = userMatch[1].trim()
      }
      continue
    }

    const line = stripComment(raw)
    if (!line) continue

    if (line.startsWith('[')) {
      if (line.toLowerCase() === '[interface]') {
        flushPeer()
        section = 'interface'
        pendingUserComment = undefined
        continue
      }
      if (line.toLowerCase() === '[peer]') {
        flushPeer()
        section = 'peer'
        currentPeer = {
          userComment: pendingUserComment,
        }
        pendingUserComment = undefined
        continue
      }
      section = 'none'
      pendingUserComment = undefined
      continue
    }

    const kv = parseKeyValue(line)
    if (!kv) continue
    const [k, v] = kv
    const key = k.toLowerCase()

    if (section === 'interface') {
      if (key === 'privatekey') iface.privateKey = v
      else if (key === 'listenport') iface.listenPort = parseInt(v, 10)
      else if (key === 'address') iface.addressRaw = v
      else if (key === 'mtu') iface.mtu = parseInt(v, 10)
      else if (key === 'dns') iface.dns = v
      else if (key === 'postup') iface.postUp = v
      else if (key === 'postdown') iface.postDown = v
      else if (key === 'fwmark') iface.fwMark = parseInt(v, 10)
    } else if (section === 'peer' && currentPeer) {
      if (key === 'publickey') currentPeer.publicKey = v
      else if (key === 'allowedips') currentPeer.allowedIPs = v
      else if (key === 'presharedkey') currentPeer.presharedKey = v
      else if (key === 'persistentkeepalive') {
        currentPeer.persistentKeepalive = parseInt(v, 10)
      }
    }
  }

  flushPeer()

  if (!iface.privateKey) {
    throw new Error('Missing [Interface] PrivateKey')
  }
  if (!iface.addressRaw) {
    throw new Error('Missing [Interface] Address')
  }

  const listenPort =
    iface.listenPort !== undefined && !isNaN(iface.listenPort)
      ? iface.listenPort
      : 51820

  return {
    interface: {
      privateKey: iface.privateKey,
      listenPort,
      addressRaw: iface.addressRaw,
      mtu: iface.mtu,
      dns: iface.dns,
      postUp: iface.postUp,
      postDown: iface.postDown,
      fwMark: iface.fwMark,
    },
    peers,
  }
}

/** First IPv4 or IPv6 CIDR from Address= line (comma-separated allowed). */
export function firstAddressCidr(addressRaw: string): { cidr: string; serverIp: string } {
  const first = addressRaw.split(',')[0].trim()
  if (!first.includes('/')) {
    return { cidr: `${first}/32`, serverIp: first }
  }
  const slash = first.lastIndexOf('/')
  const serverIp = first.slice(0, slash)
  return { cidr: first, serverIp }
}

/**
 * Infer a VPN subnet string for dashboard (IPv4 only); falls back to host /24 guess.
 */
export function inferClientAddressRange(cidr: string): string {
  const slash = cidr.lastIndexOf('/')
  if (slash === -1) {
    const parts = cidr.split('.')
    if (parts.length === 4) return `${parts.slice(0, 3).join('.')}.0/24`
    return cidr
  }
  const ip = cidr.slice(0, slash)
  const prefix = parseInt(cidr.slice(slash + 1), 10)
  const parts = ip.split('.').map((p) => parseInt(p, 10))
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return cidr
  }
  if (prefix <= 0 || prefix > 32) {
    return `${parts.join('.')}/24`
  }
  const addr =
    (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0) &
    0xffffffff
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const network = (addr & mask) >>> 0
  const o0 = (network >>> 24) & 255
  const o1 = (network >>> 16) & 255
  const o2 = (network >>> 8) & 255
  const o3 = network & 255
  return `${o0}.${o1}.${o2}.${o3}/${prefix}`
}
