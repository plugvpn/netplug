/**
 * Allowed peer icon ids for the dashboard (stored on VPNUser.peerIcon).
 * Most ids match a `lucide-react` export name; aliases use `lucideExportNameForPeerIcon`.
 */
export const PEER_ICON_IDS = [
  "User",
  "Laptop",
  "Smartphone",
  "Monitor",
  "Tablet",
  "Server",
  "Router",
  "StarLink",
  "Wifi",
  "Globe",
  "Shield",
  "Key",
  "Briefcase",
  "Home",
  "Building2",
  "Cloud",
  "UserCircle",
  "Users",
  "Bot",
  "Gamepad2",
  "Heart",
  "Star",
  "Car",
  "Plane",
  "Cpu",
] as const;

export type PeerIconId = (typeof PEER_ICON_IDS)[number];

const PEER_ICON_ID_SET = new Set<string>(PEER_ICON_IDS);

/** Dashboard id -> Lucide component name (PascalCase). */
const PEER_ICON_LUCIDE_ALIASES: Record<string, string> = {
  StarLink: "SatelliteDish",
};

export function lucideExportNameForPeerIcon(id: string): string {
  return PEER_ICON_LUCIDE_ALIASES[id] ?? id;
}

const PEER_ICON_GRID_LABELS: Partial<Record<PeerIconId, string>> = {
  User: "Person (default)",
  StarLink: "Starlink",
};

export function peerIconGridLabel(id: PeerIconId): string {
  return PEER_ICON_GRID_LABELS[id] ?? id;
}

export function normalizePeerIconForApi(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const t = value.trim();
  return PEER_ICON_ID_SET.has(t) ? t : null;
}

export function displayPeerIconId(stored: string | null | undefined): PeerIconId {
  if (stored && PEER_ICON_ID_SET.has(stored)) {
    return stored as PeerIconId;
  }
  return "User";
}
