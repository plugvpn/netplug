import { VPNServer, VPNUser, VPNConnection, DashboardStats, NetworkStats } from "@/types/vpn";

export const mockServers: VPNServer[] = [
  {
    id: "srv-1",
    name: "US East - New York",
    host: "ny.vpn.netplug.io",
    port: 1194,
    protocol: "udp",
    status: "online",
    location: "New York, USA",
    capacity: 100,
    activeConnections: 67,
    uptime: 2592000,
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "srv-2",
    name: "EU West - London",
    host: "london.vpn.netplug.io",
    port: 1194,
    protocol: "tcp",
    status: "online",
    location: "London, UK",
    capacity: 150,
    activeConnections: 98,
    uptime: 1296000,
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "srv-3",
    name: "Asia - Singapore",
    host: "sg.vpn.netplug.io",
    port: 1194,
    protocol: "udp",
    status: "maintenance",
    location: "Singapore",
    capacity: 80,
    activeConnections: 0,
    uptime: 864000,
    createdAt: new Date("2024-02-01"),
  },
];

export const mockUsers: VPNUser[] = [
  {
    id: "usr-1",
    username: "john_doe",
    email: "john@example.com",
    status: "active",
    connectedServer: "srv-1",
    bytesReceived: 5368709120,
    bytesSent: 2147483648,
    lastSeen: new Date(),
    createdAt: new Date("2024-01-10"),
  },
  {
    id: "usr-2",
    username: "jane_smith",
    email: "jane@example.com",
    status: "active",
    connectedServer: "srv-2",
    bytesReceived: 8589934592,
    bytesSent: 4294967296,
    lastSeen: new Date(),
    createdAt: new Date("2024-01-20"),
  },
  {
    id: "usr-3",
    username: "bob_wilson",
    email: "bob@example.com",
    status: "suspended",
    bytesReceived: 1073741824,
    bytesSent: 536870912,
    lastSeen: new Date(Date.now() - 86400000),
    createdAt: new Date("2024-02-01"),
  },
];

export const mockConnections: VPNConnection[] = [
  {
    id: "conn-1",
    userId: "usr-1",
    username: "john_doe",
    serverId: "srv-1",
    serverName: "US East - New York",
    allowedIps: "10.8.0.2/32",
    connectedAt: new Date(Date.now() - 3600000),
    bytesReceived: 104857600,
    bytesSent: 52428800,
    status: "connected",
  },
  {
    id: "conn-2",
    userId: "usr-2",
    username: "jane_smith",
    serverId: "srv-2",
    serverName: "EU West - London",
    allowedIps: "10.8.0.3/32",
    connectedAt: new Date(Date.now() - 7200000),
    bytesReceived: 209715200,
    bytesSent: 104857600,
    status: "connected",
  },
];

export const mockStats: DashboardStats = {
  totalServers: 3,
  activeServers: 2,
  totalUsers: 3,
  activeConnections: 2,
  totalBandwidth: {
    received: 15032385536,
    sent: 6979321856,
  },
  averageLoad: 58.5,
};

export const mockNetworkStats: NetworkStats[] = Array.from({ length: 24 }, (_, i) => ({
  timestamp: new Date(Date.now() - (23 - i) * 3600000),
  bytesIn: Math.floor(Math.random() * 1000000000) + 500000000,
  bytesOut: Math.floor(Math.random() * 500000000) + 250000000,
  connections: Math.floor(Math.random() * 100) + 50,
}));
