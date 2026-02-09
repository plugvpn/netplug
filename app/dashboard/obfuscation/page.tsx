"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Shield, Plus, Trash2, Power, PowerOff, RefreshCw } from "lucide-react";

interface ObfuscationServer {
  id: string;
  name: string;
  type: "trusttunnel" | "udp2raw";
  host: string;
  port: number;
  targetHost?: string;
  targetPort?: number;
  isActive: boolean;
  config?: any;
  createdAt: string;
  updatedAt: string;
}

export default function ObfuscationPage() {
  const [servers, setServers] = useState<ObfuscationServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "trusttunnel" as "trusttunnel" | "udp2raw",
    host: "",
    port: "",
    targetHost: "",
    targetPort: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Obfuscation | NetPlug Dashboard";
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/obfuscation');
      if (response.ok) {
        const data = await response.json();
        setServers(data);
      }
    } catch (error) {
      console.error('Failed to fetch obfuscation servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/obfuscation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          host: formData.host,
          port: parseInt(formData.port),
          targetHost: formData.targetHost || undefined,
          targetPort: formData.targetPort ? parseInt(formData.targetPort) : undefined,
        }),
      });

      if (response.ok) {
        await fetchServers();
        setShowAddModal(false);
        setFormData({
          name: "",
          type: "trusttunnel",
          host: "",
          port: "",
          targetHost: "",
          targetPort: "",
        });
      }
    } catch (error) {
      console.error('Failed to add obfuscation server:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this obfuscation server?')) {
      return;
    }

    try {
      const response = await fetch(`/api/obfuscation/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchServers();
      }
    } catch (error) {
      console.error('Failed to delete obfuscation server:', error);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/obfuscation/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        await fetchServers();
      }
    } catch (error) {
      console.error('Failed to toggle server status:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full">
        <PageHeader title="Obfuscation">
          <button
            onClick={fetchServers}
            disabled={loading}
            className="flex items-center gap-2 rounded border border-gray-300 px-4 py-1.5 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:border-gray-500"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </PageHeader>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading servers...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <PageHeader title="Obfuscation">
        <button
          onClick={fetchServers}
          disabled={loading}
          className="flex items-center gap-2 rounded border border-gray-300 px-4 py-1.5 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:border-gray-500"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </PageHeader>

      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Obfuscation Servers</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage TrustTunnel and UDP2RAW obfuscation servers
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </button>
        </div>

        {servers.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
            <Shield className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No obfuscation servers</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Get started by adding your first obfuscation server.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4" />
              Add Server
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {servers.map((server) => (
              <div
                key={server.id}
                className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-500" strokeWidth={1.5} />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{server.name}</h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        server.type === 'trusttunnel'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                      }`}>
                        {server.type === 'trusttunnel' ? 'TrustTunnel' : 'UDP2RAW'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        server.isActive
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                      }`}>
                        {server.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Host</div>
                        <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{server.host}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Port</div>
                        <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{server.port}</div>
                      </div>
                      {server.targetHost && (
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Target Host</div>
                          <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{server.targetHost}</div>
                        </div>
                      )}
                      {server.targetPort && (
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Target Port</div>
                          <div className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{server.targetPort}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(server.id, server.isActive)}
                      className="rounded p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                      title={server.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {server.isActive ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(server.id)}
                      className="rounded p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Obfuscation Server</h3>
            <form onSubmit={handleAdd} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Server Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="My Obfuscation Server"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as "trusttunnel" | "udp2raw" })}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="trusttunnel">TrustTunnel</option>
                  <option value="udp2raw">UDP2RAW</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Host
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    required
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="0.0.0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    required
                    min="1"
                    max="65535"
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="8080"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Target Host (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.targetHost}
                    onChange={(e) => setFormData({ ...formData, targetHost: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="192.168.1.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Target Port (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.targetPort}
                    onChange={(e) => setFormData({ ...formData, targetPort: e.target.value })}
                    min="1"
                    max="65535"
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="51820"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  {saving ? 'Adding...' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
