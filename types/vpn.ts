export interface VPNServer {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: "udp" | "tcp";
  status: "online" | "offline" | "maintenance";
  location: string;
  capacity: number;
  activeConnections: number;
  uptime: number;
  createdAt: Date;
}

export interface VPNUser {
  id: string;
  username: string;
  email: string;
  status: "active" | "suspended" | "expired";
  connectedServer?: string;
  bytesReceived: number;
  bytesSent: number;
  lastSeen?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface VPNConnection {
  id: string;
  userId: string;
  username: string;
  serverId: string;
  serverName: string;
  allowedIps: string;
  connectedAt: Date;
  bytesReceived: number;
  bytesSent: number;
  status: "connected" | "disconnected";
}

export interface DashboardStats {
  totalServers: number;
  activeServers: number;
  totalUsers: number;
  activeConnections: number;
  totalBandwidth: {
    received: number;
    sent: number;
  };
  averageLoad: number;
}

export interface NetworkStats {
  timestamp: Date;
  bytesIn: number;
  bytesOut: number;
  connections: number;
}

export interface ServerConfig {
  port: number;
  protocol: "udp" | "tcp";
  encryption: string;
  dns: string[];
  subnet: string;
  maxConnections: number;
}
