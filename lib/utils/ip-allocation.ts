/**
 * Parse CIDR notation and return network info
 * Example: 10.5.10.0/24 -> { network: [10, 5, 10, 0], prefix: 24 }
 */
function parseCIDR(cidr: string) {
  const [ip, prefix] = cidr.split('/');
  const octets = ip.split('.').map(Number);
  return { octets, prefix: parseInt(prefix) };
}

/**
 * Convert IP octets to a number for comparison
 */
function ipToNumber(octets: number[]): number {
  return (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

/**
 * Convert number back to IP octets
 */
function numberToIp(num: number): string {
  return [
    (num >>> 24) & 0xFF,
    (num >>> 16) & 0xFF,
    (num >>> 8) & 0xFF,
    num & 0xFF
  ].join('.');
}

/**
 * Get the next available IP address from a CIDR range
 * @param cidr - CIDR notation like "10.5.10.0/24"
 * @param serverAddress - Server IP that should be excluded (e.g., "10.5.10.1")
 * @param usedIps - Array of IPs already in use
 * @returns Next available IP address or null if range is exhausted
 */
export function getNextAvailableIP(
  cidr: string,
  serverAddress: string,
  usedIps: string[]
): string | null {
  const { octets, prefix } = parseCIDR(cidr);

  // Calculate network address and the number of available hosts
  const networkNum = ipToNumber(octets);
  const hostBits = 32 - prefix;
  const totalHosts = Math.pow(2, hostBits);

  // Create a Set of used IPs for fast lookup
  const usedSet = new Set([serverAddress, ...usedIps]);

  // Start from .2 (skip .0 network address and .1 server address)
  // End at totalHosts - 2 (skip broadcast address)
  for (let i = 2; i < totalHosts - 1; i++) {
    const candidateNum = networkNum + i;
    const candidateIp = numberToIp(candidateNum);

    if (!usedSet.has(candidateIp)) {
      return candidateIp;
    }
  }

  return null; // Range exhausted
}

/**
 * Validate if an IP is within a CIDR range
 */
export function isIpInRange(ip: string, cidr: string): boolean {
  const { octets: networkOctets, prefix } = parseCIDR(cidr);
  const ipOctets = ip.split('.').map(Number);

  const networkNum = ipToNumber(networkOctets);
  const ipNum = ipToNumber(ipOctets);

  const hostBits = 32 - prefix;
  const mask = ~((1 << hostBits) - 1);

  return (networkNum & mask) === (ipNum & mask);
}

/**
 * Validate if a string is a valid IP address
 */
export function isValidIPAddress(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
  });
}
