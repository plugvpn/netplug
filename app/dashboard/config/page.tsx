import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Network, Shield, Database } from "lucide-react";

export default function ConfigPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground">
          Manage your VPN server settings and policies
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              <CardTitle>Network Settings</CardTitle>
            </div>
            <CardDescription>Configure network and connection parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Port</label>
              <input
                type="number"
                defaultValue="1194"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Protocol</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option>UDP</option>
                <option>TCP</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subnet</label>
              <input
                type="text"
                defaultValue="10.8.0.0/24"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save Changes
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Security Settings</CardTitle>
            </div>
            <CardDescription>Configure encryption and authentication</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Encryption Cipher</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option>AES-256-GCM</option>
                <option>AES-128-GCM</option>
                <option>ChaCha20-Poly1305</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Authentication</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option>SHA256</option>
                <option>SHA384</option>
                <option>SHA512</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="tls-auth" className="rounded" />
              <label htmlFor="tls-auth" className="text-sm font-medium">
                Enable TLS Authentication
              </label>
            </div>
            <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save Changes
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>DNS Settings</CardTitle>
            </div>
            <CardDescription>Configure DNS servers for clients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary DNS</label>
              <input
                type="text"
                defaultValue="1.1.1.1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Secondary DNS</label>
              <input
                type="text"
                defaultValue="8.8.8.8"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save Changes
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Connection Limits</CardTitle>
            </div>
            <CardDescription>Set connection and bandwidth limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Connections per Server</label>
              <input
                type="number"
                defaultValue="100"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Session Timeout (minutes)</label>
              <input
                type="number"
                defaultValue="1440"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="auto-reconnect" className="rounded" defaultChecked />
              <label htmlFor="auto-reconnect" className="text-sm font-medium">
                Allow Auto-Reconnect
              </label>
            </div>
            <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save Changes
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
