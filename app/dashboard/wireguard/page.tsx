"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  Server,
  Save,
  RefreshCw,
  Copy,
  Check,
  Settings,
  Globe,
  Eye,
  EyeOff,
  SlidersHorizontal,
  KeyRound,
} from "lucide-react";

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
  preUp?: string;
  preDown?: string;
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

/** From `wg show` — whether the tunnel is actually up (not DB isActive). */
interface WireGuardLiveStatus {
  up: boolean;
  interfaceName?: string;
  listenPort?: number;
}

function formatUptime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '—';
  }
  if (totalSeconds < 60) {
    return `${Math.floor(totalSeconds)}s`;
  }
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (d > 0 || h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
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
  const [live, setLive] = useState<WireGuardLiveStatus | null>(null);
  const [hostUptimeSeconds, setHostUptimeSeconds] = useState<number | null>(null);
  const [tunnelUptimeSeconds, setTunnelUptimeSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [publicKeyCopied, setPublicKeyCopied] = useState(false);
  const [privateKeyCopied, setPrivateKeyCopied] = useState(false);
  const [privateKeyDraft, setPrivateKeyDraft] = useState('');
  const [originalPrivateKey, setOriginalPrivateKey] = useState('');
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);

  useEffect(() => {
    document.title = "Wireguard | NetPlug Dashboard";
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoadError(null);
    try {
      const response = await fetch('/api/wireguard');
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setLoadError('You need to sign in again to view WireGuard settings.');
        setConfig(null);
        setServer(null);
        setLive(null);
        setHostUptimeSeconds(null);
        setTunnelUptimeSeconds(null);
        setPrivateKeyDraft('');
        setOriginalPrivateKey('');
        setPrivateKeyVisible(false);
        return;
      }

      if (!response.ok) {
        setLoadError(
          typeof data.error === 'string'
            ? data.error
            : `Could not load WireGuard configuration (${response.status}).`
        );
        setConfig(null);
        setServer(null);
        setLive(null);
        setHostUptimeSeconds(null);
        setTunnelUptimeSeconds(null);
        setPrivateKeyDraft('');
        setOriginalPrivateKey('');
        setPrivateKeyVisible(false);
        return;
      }

      if (!data.config) {
        setLoadError('WireGuard configuration is missing from the server.');
        setConfig(null);
        setServer(null);
        setLive(null);
        setHostUptimeSeconds(null);
        setTunnelUptimeSeconds(null);
        setPrivateKeyDraft('');
        setOriginalPrivateKey('');
        setPrivateKeyVisible(false);
        return;
      }

      setConfig(data.config);
      setOriginalConfig(data.config);
      setServer(data.server ?? null);
      const pk = (data.server as ServerInfo | null)?.privateKey ?? '';
      setPrivateKeyDraft(pk);
      setOriginalPrivateKey(pk);
      setPrivateKeyVisible(false);
      const livePayload = data.live as WireGuardLiveStatus | undefined;
      setLive(
        livePayload && typeof livePayload.up === 'boolean'
          ? livePayload
          : { up: false },
      );
      const hostSec = data.hostUptimeSeconds;
      setHostUptimeSeconds(
        typeof hostSec === 'number' && Number.isFinite(hostSec) ? hostSec : null,
      );
      const tunSec = data.tunnelUptimeSeconds;
      setTunnelUptimeSeconds(
        typeof tunSec === 'number' && Number.isFinite(tunSec) ? tunSec : null,
      );
    } catch (error) {
      console.error('Failed to fetch WireGuard configuration:', error);
      setLoadError('Network error while loading WireGuard configuration.');
      setConfig(null);
      setServer(null);
      setLive(null);
      setHostUptimeSeconds(null);
      setTunnelUptimeSeconds(null);
      setPrivateKeyDraft('');
      setOriginalPrivateKey('');
      setPrivateKeyVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    if (!config || !originalConfig) return false;
    if (privateKeyDraft !== originalPrivateKey) return true;
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig(originalConfig);
      setSaveMessage(null);
    }
    setPrivateKeyDraft(originalPrivateKey);
    setPrivateKeyVisible(false);
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const payload: { config: WireGuardConfig; serverPrivateKey?: string } = {
        config,
      };
      if (privateKeyDraft !== originalPrivateKey) {
        payload.serverPrivateKey = privateKeyDraft;
      }
      const response = await fetch('/api/wireguard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const writeFailed = data.wireGuardWriteOk === false;
        const reloadFailed = data.wireGuardReloaded === false;
        setSaveMessage({
          type: writeFailed || reloadFailed ? 'error' : 'success',
          text:
            typeof data.message === 'string'
              ? data.message
              : 'Configuration saved successfully!',
        });
        setOriginalConfig(config);
        if (privateKeyDraft !== originalPrivateKey) {
          setOriginalPrivateKey(privateKeyDraft);
        }
        void fetchConfig();
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

  const handleCopyPrivateKey = async () => {
    if (!privateKeyDraft) return;
    try {
      await navigator.clipboard.writeText(privateKeyDraft);
      setPrivateKeyCopied(true);
      setTimeout(() => setPrivateKeyCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy private key:', error);
    }
  };

  const uptimeDisplaySeconds =
    live?.up && tunnelUptimeSeconds != null
      ? tunnelUptimeSeconds
      : hostUptimeSeconds;
  const uptimeCaption =
    live?.up && tunnelUptimeSeconds != null
      ? 'WireGuard tunnel'
      : 'This system';

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
        <PageHeader title="Wireguard">
          <button
            onClick={() => {
              setLoading(true);
              fetchConfig();
            }}
            disabled={loading}
            className="flex items-center gap-2 rounded border border-gray-300 px-4 py-1.5 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:border-gray-500"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </PageHeader>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12">
          <p className="text-center text-gray-600 dark:text-gray-400 max-w-lg">
            {loadError ||
              'WireGuard is not configured yet. Finish the setup wizard or check the database.'}
          </p>
          {loadError?.includes('sign in') && (
            <a
              href="/login"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Go to login
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Wireguard">
        <button
          onClick={fetchConfig}
          disabled={loading}
          className="flex items-center gap-2 rounded border border-gray-300 px-4 py-1.5 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:border-gray-500"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Wireguard</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Configure and manage your WireGuard VPN server settings
            </p>
          </div>

          <div className="space-y-6">
            {/* Server Status */}
            <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {server ? (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
                  <div>
                    <div className="mb-6 flex items-center gap-2">
                      <Server
                        className="h-5 w-5 text-emerald-600 dark:text-emerald-500"
                        strokeWidth={1.5}
                      />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Server Status
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="shrink-0 text-sm text-gray-700 dark:text-gray-300">Server Name</span>
                        <span className="min-w-0 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                          {server.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="shrink-0 text-sm text-gray-700 dark:text-gray-300">Interface status</span>
                        <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                live?.up ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {live?.up ? 'Running' : 'Not running'}
                            </span>
                          </div>
                          {live?.up && live.interfaceName && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {live.interfaceName}
                              {typeof live.listenPort === 'number' && !Number.isNaN(live.listenPort)
                                ? ` · listen ${live.listenPort}`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="shrink-0 text-sm text-gray-700 dark:text-gray-300">Uptime</span>
                        <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {uptimeDisplaySeconds != null
                              ? formatUptime(uptimeDisplaySeconds)
                              : '—'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {uptimeCaption}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="shrink-0 text-sm text-gray-700 dark:text-gray-300">Config Path</span>
                        <span className="min-w-0 break-all text-right font-mono text-sm text-gray-900 dark:text-gray-100">
                          {server.configPath}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 lg:border-l lg:border-gray-200 lg:pl-10 dark:lg:border-gray-700">
                    <div className="mb-6 flex items-center gap-2">
                      <KeyRound
                        className="h-5 w-5 text-emerald-600 dark:text-emerald-500"
                        strokeWidth={1.5}
                      />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Keys</h3>
                    </div>
                    <div>
                      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Server Private Key
                      </span>
                      <div className="relative">
                        <input
                          type={privateKeyVisible ? "text" : "password"}
                          value={privateKeyDraft}
                          onChange={(e) => setPrivateKeyDraft(e.target.value)}
                          spellCheck={false}
                          autoComplete="off"
                          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-[4.25rem] font-mono text-xs text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          placeholder="WireGuard interface private key"
                        />
                        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setPrivateKeyVisible((v) => !v)}
                            title={privateKeyVisible ? "Hide private key" : "Show private key"}
                            aria-label={privateKeyVisible ? "Hide private key" : "Show private key"}
                            aria-pressed={privateKeyVisible}
                            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          >
                            {privateKeyVisible ? (
                              <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                            ) : (
                              <Eye className="h-4 w-4" strokeWidth={1.5} />
                            )}
                          </button>
                          {privateKeyDraft ? (
                            <button
                              type="button"
                              onClick={handleCopyPrivateKey}
                              title={privateKeyCopied ? "Copied" : "Copy private key"}
                              aria-label={privateKeyCopied ? "Copied" : "Copy private key"}
                              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                            >
                              {privateKeyCopied ? (
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                              ) : (
                                <Copy className="h-4 w-4" strokeWidth={1.5} />
                              )}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Hidden by default. The public key is derived when you save.
                      </p>
                    </div>

                    <div className="mt-8 border-t border-gray-200 pt-8 dark:border-gray-700">
                      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Server Public Key
                      </span>
                      {server.publicKey ? (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              value={server.publicKey}
                              readOnly
                              className="w-full cursor-text rounded-lg border border-gray-200 bg-gray-50 py-2 pl-3 pr-10 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={handleCopyPublicKey}
                              title={publicKeyCopied ? "Copied" : "Copy public key"}
                              aria-label={publicKeyCopied ? "Copied" : "Copy public key"}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            >
                              {publicKeyCopied ? (
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                              ) : (
                                <Copy className="h-4 w-4" strokeWidth={1.5} />
                              )}
                            </button>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            Share this public key with clients connecting to this server
                          </p>
                        </>
                      ) : (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Public key not available. Re-run setup or check that the WireGuard server row
                            exists in the database.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Server record not loaded. Refresh or check the database.
                </p>
              )}
            </div>

            {/* Server Settings (left) + Network Settings (right) */}
            <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
                <div>
                  <div className="mb-6 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-emerald-600 dark:text-emerald-500" strokeWidth={1.5} />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Server Settings</h3>
                  </div>
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

                <div className="lg:border-l lg:border-gray-200 lg:pl-10 dark:lg:border-gray-700">
                  <div className="mb-6 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-500" strokeWidth={1.5} />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Network Settings</h3>
                  </div>
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
              </div>
            </div>

          {/* Advanced Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
              <SlidersHorizontal
                className="h-5 w-5 text-emerald-600 dark:text-emerald-500"
                strokeWidth={1.5}
              />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Advanced Settings</h3>
            </div>
            <div className="space-y-0">
              <TextAreaField
                label="PreUp"
                value={config.preUp || ''}
                field="preUp"
                placeholder="Commands to run before interface is brought up (optional)"
                onChange={updateConfig}
              />
              <TextAreaField
                label="PostUp"
                value={config.postUp || ''}
                field="postUp"
                placeholder="Commands to run after interface is up (optional)"
                onChange={updateConfig}
              />
              <TextAreaField
                label="PreDown"
                value={config.preDown || ''}
                field="preDown"
                placeholder="Commands to run before interface is taken down (optional)"
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
