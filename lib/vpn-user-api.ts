import { peerIpFromAllowedIps } from '@/lib/allowed-ips';

/** BigInt-safe JSON plus `ipAddress` derived from `allowedIps` for clients. */
export function serializeVpnUserForApi(user: unknown) {
  const serialized = JSON.parse(
    JSON.stringify(user, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
  );
  return {
    ...serialized,
    ipAddress: peerIpFromAllowedIps(serialized.allowedIps),
  };
}
