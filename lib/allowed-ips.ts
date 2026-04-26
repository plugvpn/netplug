/**
 * Parse comma/newline-separated AllowedIPs (WireGuard) for display and forms.
 */

export const normalizeIpList = (rawValue: string) =>
  rawValue
    .split(/[\n,]+/)
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);

export function splitAllowedIps(allowedIps: string | null) {
  if (!allowedIps) {
    return { peerIp: null as string | null, routingAllowedIps: null as string | null };
  }

  const ips = normalizeIpList(allowedIps);
  if (ips.length === 0) {
    return { peerIp: null, routingAllowedIps: null };
  }

  const [peerIp, ...routingIps] = ips;
  return {
    peerIp,
    routingAllowedIps: routingIps.length > 0 ? routingIps.join(',') : null,
  };
}

/** First peer entry from AllowedIPs (for API `ipAddress` and tables). */
export function peerIpFromAllowedIps(allowedIps: string | null | undefined): string | null {
  return splitAllowedIps(allowedIps ?? null).peerIp;
}
