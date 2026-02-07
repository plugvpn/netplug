import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockConnections } from "@/lib/mock-data";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Activity, Server, User } from "lucide-react";

export default function ConnectionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Connections</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of VPN connections
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockConnections.length}</div>
            <p className="text-xs text-muted-foreground">Active right now</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">Today at 2:00 PM</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.5h</div>
            <p className="text-xs text-muted-foreground">Per session</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockConnections.map((conn) => (
              <div
                key={conn.id}
                className="rounded-lg border p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        User
                      </span>
                    </div>
                    <p className="font-medium">{conn.username}</p>
                    <p className="text-sm text-muted-foreground">{conn.ipAddress}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Server
                      </span>
                    </div>
                    <p className="font-medium">{conn.serverName}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Data Transfer
                      </span>
                    </div>
                    <p className="text-sm">↓ {formatBytes(conn.bytesReceived)}</p>
                    <p className="text-sm">↑ {formatBytes(conn.bytesSent)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Duration
                      </span>
                    </div>
                    <p className="text-sm">
                      {formatDistanceToNow(conn.connectedAt, { addSuffix: false })}
                    </p>
                    <button className="mt-2 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
