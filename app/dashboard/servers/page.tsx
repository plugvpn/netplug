"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Server,
  Settings,
  Power,
  FolderOpen,
  Edit3,
  X,
  Shield,
  Radio,
} from "lucide-react";

interface VPNServer {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number | null;
  configPath: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  config?: any;
}

export default function ServersPage() {
  const [servers, setServers] = useState<VPNServer[]>([]);
  const [editingServer, setEditingServer] = useState<VPNServer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/servers');
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
      setServers([
        {
          id: 'openvpn',
          name: 'OpenVPN Server',
          protocol: 'openvpn',
          host: 'vpn1.netplug.io',
          port: 1194,
          configPath: '/etc/openvpn/server.conf',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          config: {
            network: '10.8.0.0',
            netmask: '255.255.255.0',
            primaryDns: '1.1.1.1',
            secondaryDns: '1.0.0.1',
            cipher: 'AES-256-GCM',
            auth: 'SHA256',
            maxClients: 100,
          },
        },
        {
          id: 'wireguard',
          name: 'WireGuard Server',
          protocol: 'wireguard',
          host: 'wg.netplug.io',
          port: 51820,
          configPath: '$DATA_DIR/wg0.conf',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          config: {
            serverAddress: '10.0.0.1/24',
            clientAddressRange: '10.0.0.2/24',
            dns: '1.1.1.1, 1.0.0.1',
            mtu: 1420,
            persistentKeepalive: 25,
            allowedIps: '0.0.0.0/0, ::/0',
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (server: VPNServer) => {
    setEditingServer({ ...server });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingServer) return;

    try {
      const response = await fetch(`/api/servers/${editingServer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: editingServer.host,
          port: editingServer.port,
          isActive: editingServer.isActive,
          config: editingServer.config,
        }),
      });

      if (response.ok) {
        await fetchServers();
        setIsModalOpen(false);
        setEditingServer(null);
      } else {
        const error = await response.json();
        console.error('Failed to update server:', error);
        alert(`Failed to update server: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update server:', error);
      alert('Failed to update server. Please try again.');
    }
  };

  const toggleServerStatus = async (server: VPNServer) => {
    try {
      const payload = {
        host: server.host,
        port: server.port,
        isActive: !server.isActive,
        config: server.config,
      };

      const response = await fetch(`/api/servers/${server.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchServers();
      } else {
        const error = await response.json();
        alert(`Failed to toggle server: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to toggle server status:', error);
      alert('Failed to toggle server status. Please try again.');
    }
  };

  const getProtocolStyles = (protocol: string) => {
    if (protocol === 'openvpn') {
      return {
        badge: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30',
        icon: Shield,
        glow: 'shadow-cyan-500/20',
      };
    }
    return {
      badge: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30',
      icon: Radio,
      glow: 'shadow-violet-500/20',
    };
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header */}
      <PageHeader title="VPN Servers" />

      {/* Content */}
      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">VPN Servers</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your VPN server configurations and monitor their status
          </p>
        </div>

        {/* Server Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {servers.map((server) => {
            const protocolConfig = getProtocolStyles(server.protocol);
            const ProtocolIcon = protocolConfig.icon;

            return (
              <Card
                key={server.id}
                className="group relative overflow-hidden border-gray-200 bg-white shadow-sm transition-all hover:border-emerald-500/30 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-3">
                        <div className={`rounded-md border p-2 ${protocolConfig.badge}`}>
                          <ProtocolIcon className="h-4 w-4" />
                        </div>
                        <span className={`rounded border px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-wider ${protocolConfig.badge}`}>
                          {server.protocol}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{server.name}</h3>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
                        server.isActive
                          ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                          : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                      }`}>
                        <div className={`h-2 w-2 rounded-full ${
                          server.isActive ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-600'
                        }`} />
                        <span className={`text-xs font-semibold ${
                          server.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {server.isActive ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Technical Details */}
                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <Server className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <span className="text-gray-500 dark:text-gray-400">host:</span>
                      <span className="text-gray-900 dark:text-gray-100">{server.host}</span>
                    </div>

                    {server.port && (
                      <div className="flex items-center gap-3">
                        <Settings className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-gray-500 dark:text-gray-400">port:</span>
                        <span className="text-gray-900 dark:text-gray-100">{server.port}</span>
                      </div>
                    )}

                    {server.configPath && (
                      <div className="flex items-center gap-3">
                        <FolderOpen className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-gray-500 dark:text-gray-400">config:</span>
                        <span className="truncate text-gray-700 dark:text-gray-300">{server.configPath}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleServerStatus(server)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                        server.isActive
                          ? 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900'
                      }`}
                    >
                      <Power className="h-4 w-4" />
                      {server.isActive ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      onClick={() => handleEdit(server)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <Edit3 className="h-4 w-4" />
                      Configure
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {servers.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20 dark:border-gray-700 dark:bg-gray-800/50">
            <Server className="mb-4 h-16 w-16 text-gray-400 dark:text-gray-600" />
            <h3 className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-400">No servers configured</h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-500">Complete the setup wizard to configure VPN servers</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Edit Server Configuration
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Update {editingServer.protocol === 'openvpn' ? 'OpenVPN' : 'WireGuard'} server settings
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingServer(null);
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
              {/* Protocol Display (read-only) */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Protocol
                </label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    {editingServer.protocol === 'openvpn' ? (
                      <>
                        <Shield className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        <span className="font-mono text-sm font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
                          OpenVPN
                        </span>
                      </>
                    ) : (
                      <>
                        <Radio className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        <span className="font-mono text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                          WireGuard
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* OpenVPN-specific fields */}
              {editingServer.protocol === 'openvpn' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Server URL
                      </label>
                      <input
                        type="text"
                        value={editingServer.host}
                        onChange={(e) => setEditingServer({ ...editingServer, host: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="vpn.example.com"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Port
                      </label>
                      <input
                        type="number"
                        value={editingServer.port || ''}
                        onChange={(e) => setEditingServer({ ...editingServer, port: parseInt(e.target.value) || null })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="1194"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Network
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.network || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, network: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="10.8.0.0"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Netmask
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.netmask || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, netmask: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="255.255.255.0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Primary DNS
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.primaryDns || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, primaryDns: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="1.1.1.1"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Secondary DNS
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.secondaryDns || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, secondaryDns: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="1.0.0.1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cipher
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.cipher || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, cipher: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="AES-256-GCM"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Auth
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.auth || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, auth: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="SHA256"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Max Clients
                    </label>
                    <input
                      type="number"
                      value={(editingServer as any).config?.maxClients || ''}
                      onChange={(e) => setEditingServer({
                        ...editingServer,
                        config: { ...(editingServer as any).config, maxClients: parseInt(e.target.value) || 100 }
                      } as any)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 font-mono text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="100"
                    />
                  </div>
                </>
              )}

              {/* WireGuard-specific fields */}
              {editingServer.protocol === 'wireguard' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Server Host
                      </label>
                      <input
                        type="text"
                        value={editingServer.host}
                        onChange={(e) => setEditingServer({ ...editingServer, host: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="wg.example.com"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Port
                      </label>
                      <input
                        type="number"
                        value={editingServer.port || ''}
                        onChange={(e) => setEditingServer({ ...editingServer, port: parseInt(e.target.value) || null })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="51820"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Server Address
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.serverAddress || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, serverAddress: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="10.0.0.1/24"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Client Address Range
                      </label>
                      <input
                        type="text"
                        value={(editingServer as any).config?.clientAddressRange || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, clientAddressRange: e.target.value }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="10.0.0.2/24"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      DNS Servers
                    </label>
                    <input
                      type="text"
                      value={(editingServer as any).config?.dns || ''}
                      onChange={(e) => setEditingServer({
                        ...editingServer,
                        config: { ...(editingServer as any).config, dns: e.target.value }
                      } as any)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 font-mono text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="1.1.1.1, 1.0.0.1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        MTU
                      </label>
                      <input
                        type="number"
                        value={(editingServer as any).config?.mtu || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, mtu: parseInt(e.target.value) || 1420 }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="1420"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Persistent Keepalive
                      </label>
                      <input
                        type="number"
                        value={(editingServer as any).config?.persistentKeepalive || ''}
                        onChange={(e) => setEditingServer({
                          ...editingServer,
                          config: { ...(editingServer as any).config, persistentKeepalive: parseInt(e.target.value) || 25 }
                        } as any)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        placeholder="25"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Allowed IPs
                    </label>
                    <input
                      type="text"
                      value={(editingServer as any).config?.allowedIps || ''}
                      onChange={(e) => setEditingServer({
                        ...editingServer,
                        config: { ...(editingServer as any).config, allowedIps: e.target.value }
                      } as any)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 font-mono text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="0.0.0.0/0, ::/0"
                    />
                  </div>
                </>
              )}

              {/* Config Path */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Configuration Path
                </label>
                <input
                  type="text"
                  value={editingServer.configPath || ''}
                  onChange={(e) => setEditingServer({ ...editingServer, configPath: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 font-mono text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder={editingServer.protocol === 'openvpn' ? '/etc/openvpn/server.conf' : '$DATA_DIR/wg0.conf'}
                  readOnly
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Server Status</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Enable or disable this server</p>
                </div>
                <button
                  onClick={() => setEditingServer({ ...editingServer, isActive: !editingServer.isActive })}
                  className={`relative h-7 w-14 rounded-full transition-colors ${
                    editingServer.isActive ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                      editingServer.isActive ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 border-t border-gray-200 p-6 dark:border-gray-700">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingServer(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
