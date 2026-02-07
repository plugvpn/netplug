"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Server, Save, RefreshCw, Copy, Check } from "lucide-react";

interface WireGuardConfig {
  enabled: boolean;
  serverHost: string;
  serverPort: number;
  serverAddress: string;
  clientAddressRange: string;
  dns: string;
  mtu: number;
  persistentKeepalive: number;
  allowedIps: string;
  postUp?: string;
  postDown?: string;
}

interface ServerInfo {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  configPath: string;
  isActive: boolean;
  privateKey: string | null;
  publicKey: string | null;
}

// Move component definitions outside to prevent focus loss
const InputField = ({
  label,
  value,
  field,
  type = "text",
  placeholder = "",
  onChange
}: {
  label: string;
  value: string | number;
  field: string;
  type?: string;
  placeholder?: string;
  onChange: (field: string, value: string | number) => void;
}) => (
  <div className="border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-800">
    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(field, type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-emerald-600"
    />
  </div>
);

const TextAreaField = ({
  label,
  value,
  field,
  placeholder = "",
  onChange
}: {
  label: string;
  value: string;
  field: string;
  placeholder?: string;
  onChange: (field: string, value: string) => void;
}) => (
  <div className="border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-800">
    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <textarea
      value={value || ''}
      onChange={(e) => onChange(field, e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-emerald-600"
    />
  </div>
);

export default function WireguardConfigPage() {
  const [config, setConfig] = useState<WireGuardConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<WireGuardConfig | null>(null);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [publicKeyCopied, setPublicKeyCopied] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/wireguard');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setOriginalConfig(data.config);
        setServer(data.server);
      }
    } catch (error) {
      console.error('Failed to fetch WireGuard configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    if (!config || !originalConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig(originalConfig);
      setSaveMessage(null);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/wireguard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Configuration saved successfully!' });
        setOriginalConfig(config);
      } else {
        const data = await response.json();
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const updateConfig = (field: string, value: string | number) => {
    if (!config) return;
    setConfig({ ...config, [field as keyof WireGuardConfig]: value });
  };

  const handleCopyPublicKey = async () => {
    if (!server?.publicKey) return;
    try {
      await navigator.clipboard.writeText(server.publicKey);
      setPublicKeyCopied(true);
      setTimeout(() => setPublicKeyCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy public key:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full">
        <PageHeader title="Wireguard Configuration" />
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 dark:text-gray-400">Loading configuration...</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="h-full">
        <PageHeader title="Wireguard Configuration" />
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 dark:text-gray-400">WireGuard is not configured yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Wireguard Configuration" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">WireGuard Configuration</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Configure and manage your WireGuard VPN server settings
            </p>
          </div>

          <div className="space-y-6">
            {/* Server Status */}
            <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
              <Server className="h-5 w-5 text-emerald-600 dark:text-emerald-500" strokeWidth={1.5} />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Server Status</h2>
            </div>
            {server && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Server Name</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{server.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${server.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {server.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Config Path</span>
                  <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{server.configPath}</span>
                </div>
                {server.publicKey && (
                  <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Server Public Key</span>
                      <button
                        onClick={handleCopyPublicKey}
                        className="flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                      >
                        {publicKeyCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={server.publicKey}
                        readOnly
                        className="w-full cursor-text rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Share this public key with clients connecting to this server
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Server Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-6 text-base font-semibold text-gray-900 dark:text-gray-100">Server Settings</h3>
            <div className="space-y-0">
              <InputField
                label="Server Host"
                value={config.serverHost}
                field="serverHost"
                placeholder="e.g., vpn.example.com or 192.168.1.1"
                onChange={updateConfig}
              />
              <InputField
                label="Server Port"
                value={config.serverPort}
                field="serverPort"
                type="number"
                placeholder="e.g., 51820"
                onChange={updateConfig}
              />
              <InputField
                label="Server Address"
                value={config.serverAddress}
                field="serverAddress"
                placeholder="e.g., 10.0.0.1/24"
                onChange={updateConfig}
              />
              <InputField
                label="Client Address Range"
                value={config.clientAddressRange}
                field="clientAddressRange"
                placeholder="e.g., 10.0.0.0/24"
                onChange={updateConfig}
              />
            </div>
          </div>

          {/* Network Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-6 text-base font-semibold text-gray-900 dark:text-gray-100">Network Settings</h3>
            <div className="space-y-0">
              <InputField
                label="DNS Servers"
                value={config.dns}
                field="dns"
                placeholder="e.g., 1.1.1.1, 8.8.8.8"
                onChange={updateConfig}
              />
              <InputField
                label="MTU"
                value={config.mtu}
                field="mtu"
                type="number"
                placeholder="e.g., 1420"
                onChange={updateConfig}
              />
              <InputField
                label="Persistent Keepalive (seconds)"
                value={config.persistentKeepalive}
                field="persistentKeepalive"
                type="number"
                placeholder="e.g., 25"
                onChange={updateConfig}
              />
              <InputField
                label="Allowed IPs"
                value={config.allowedIps}
                field="allowedIps"
                placeholder="e.g., 0.0.0.0/0, ::/0"
                onChange={updateConfig}
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-6 text-base font-semibold text-gray-900 dark:text-gray-100">Advanced Settings</h3>
            <div className="space-y-0">
              <TextAreaField
                label="PostUp"
                value={config.postUp || ''}
                field="postUp"
                placeholder="Commands to run after interface is up (optional)"
                onChange={updateConfig}
              />
              <TextAreaField
                label="PostDown"
                value={config.postDown || ''}
                field="postDown"
                placeholder="Commands to run after interface is down (optional)"
                onChange={updateConfig}
              />
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Save Bar at Bottom */}
      <div className="border-t border-gray-200 bg-white px-8 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={saving || !hasChanges()}
              className="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
          </div>
          {saveMessage && (
            <div className={`text-sm font-medium ${saveMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
              {saveMessage.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
