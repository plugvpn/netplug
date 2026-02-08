"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { User, Activity, X, Edit3, Trash2, Plus, Server, QrCode, Copy, Check, Eye, EyeOff, RefreshCw, Key } from "lucide-react";
import { ToastProvider, useToast } from "@/components/ToastProvider";
import { QRCodeSVG } from "qrcode.react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface VPNServer {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number | null;
  isActive: boolean;
  privateKey: string | null;
  publicKey: string | null;
}

interface VPNUser {
  id: string;
  username: string;
  commonName: string | null;
  ipAddress: string | null;
  privateKey: string | null;
  publicKey: string | null;
  presharedKey: string | null;
  bytesReceived: string;  // Serialized from BigInt
  bytesSent: string;  // Serialized from BigInt
  totalBytesReceived: string;  // Serialized from BigInt
  totalBytesSent: string;  // Serialized from BigInt
  remainingDays: number | null;
  remainingTrafficGB: number | null;
  connectedAt: Date | null;
  isConnected: boolean;
  isEnabled: boolean;
  serverId: string;
  createdAt: Date;
  updatedAt: Date;
  server: VPNServer;
}

// Custom syntax highlighter theme matching dashboard
const customSyntaxTheme = {
  'code[class*="language-"]': {
    color: '#e5e7eb',
    background: 'transparent',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.75rem',
    textAlign: 'left' as const,
    whiteSpace: 'pre' as const,
    wordSpacing: 'normal',
    wordBreak: 'normal' as const,
    wordWrap: 'normal' as const,
    lineHeight: '1.5',
    hyphens: 'none' as const,
  },
  'pre[class*="language-"]': {
    color: '#e5e7eb',
    background: '#111827',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.75rem',
    textAlign: 'left' as const,
    whiteSpace: 'pre' as const,
    wordSpacing: 'normal',
    wordBreak: 'normal' as const,
    wordWrap: 'normal' as const,
    lineHeight: '1.5',
    hyphens: 'none' as const,
    padding: '1em',
    margin: '0',
    overflow: 'auto' as const,
  },
  'comment': {
    color: '#6b7280',
    fontStyle: 'italic' as const,
  },
  'prolog': {
    color: '#6b7280',
  },
  'doctype': {
    color: '#6b7280',
  },
  'cdata': {
    color: '#6b7280',
  },
  'punctuation': {
    color: '#9ca3af',
  },
  'property': {
    color: '#10b981',
  },
  'tag': {
    color: '#3b82f6',
  },
  'boolean': {
    color: '#f59e0b',
  },
  'number': {
    color: '#f59e0b',
  },
  'constant': {
    color: '#f59e0b',
  },
  'symbol': {
    color: '#f59e0b',
  },
  'deleted': {
    color: '#ef4444',
  },
  'selector': {
    color: '#10b981',
  },
  'attr-name': {
    color: '#10b981',
  },
  'string': {
    color: '#14b8a6',
  },
  'char': {
    color: '#14b8a6',
  },
  'builtin': {
    color: '#14b8a6',
  },
  'inserted': {
    color: '#10b981',
  },
  'operator': {
    color: '#9ca3af',
  },
  'entity': {
    color: '#14b8a6',
  },
  'url': {
    color: '#14b8a6',
  },
  'variable': {
    color: '#14b8a6',
  },
  'atrule': {
    color: '#3b82f6',
  },
  'attr-value': {
    color: '#14b8a6',
  },
  'function': {
    color: '#3b82f6',
  },
  'class-name': {
    color: '#f59e0b',
  },
  'keyword': {
    color: '#8b5cf6',
  },
  'regex': {
    color: '#ec4899',
  },
  'important': {
    color: '#ef4444',
    fontWeight: 'bold' as const,
  },
  'bold': {
    fontWeight: 'bold' as const,
  },
  'italic': {
    fontStyle: 'italic' as const,
  },
};

function UsersPageContent() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<VPNUser[]>([]);
  const [servers, setServers] = useState<VPNServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<VPNUser> | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<VPNUser | null>(null);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  const [qrCodeUser, setQrCodeUser] = useState<VPNUser | null>(null);
  const [configCopied, setConfigCopied] = useState(false);
  const [configText, setConfigText] = useState<string>('');
  const [configFileName, setConfigFileName] = useState<string>('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showPresharedKey, setShowPresharedKey] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [generatingPsk, setGeneratingPsk] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchServers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');

      if (!response.ok) {
        console.error('API error:', response.status);
        setUsers([]);
        return;
      }

      const data = await response.json();

      // Ensure data is an array before setting
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('API returned non-array data:', data);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/servers');
      const data = await response.json();

      // Ensure data is an array before setting
      if (Array.isArray(data)) {
        setServers(data);
      } else {
        console.error('API returned non-array data:', data);
        setServers([]);
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
      setServers([]);
    }
  };

  const handleAddUser = async () => {
    // Default to WireGuard server
    const wireguardServer = servers.find(s => s.protocol === 'wireguard');
    const serverId = wireguardServer?.id || 'wireguard';

    const newUser: Partial<VPNUser> = {
      username: '',
      serverId: serverId,
      commonName: '',
      ipAddress: null,
      privateKey: '',
      publicKey: '',
      presharedKey: null,
      remainingDays: null,
      remainingTrafficGB: null,
      isEnabled: true,
    };

    // Fetch next available IP for WireGuard servers
    try {
      const response = await fetch(`/api/users/next-ip?serverId=${serverId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.ipAddress) {
          newUser.ipAddress = data.ipAddress;
        }
      }
    } catch (error) {
      console.error('Failed to fetch next IP:', error);
    }

    // Auto-generate keys for new user
    try {
      const response = await fetch('/api/setup/generate-keys', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        newUser.privateKey = data.privateKey;
        newUser.publicKey = data.publicKey;
      }
    } catch (error) {
      console.error('Failed to generate keys:', error);
    }

    setEditingUser(newUser);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: VPNUser) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const fetchNextIP = async (serverId: string) => {
    try {
      const response = await fetch(`/api/users/next-ip?serverId=${serverId}`);
      if (response.ok) {
        const data = await response.json();
        return data.ipAddress;
      }
    } catch (error) {
      console.error('Failed to fetch next IP:', error);
    }
    return null;
  };

  const handleServerChange = async (serverId: string) => {
    const selectedServer = servers.find(s => s.id === serverId);
    const updatedUser = { ...editingUser, serverId };

    // If it's a new user and WireGuard server, fetch next IP
    if (!editingUser?.id && selectedServer?.protocol === 'wireguard') {
      const nextIp = await fetchNextIP(serverId);
      if (nextIp) {
        updatedUser.ipAddress = nextIp;
      }
    }

    setEditingUser(updatedUser);
  };

  const handleGenerateKeys = async () => {
    setGeneratingKeys(true);
    try {
      const response = await fetch('/api/setup/generate-keys', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setEditingUser({
          ...editingUser,
          privateKey: data.privateKey,
          publicKey: data.publicKey,
        });
        showToast('Keys generated successfully!', 'success');
      } else {
        showToast('Failed to generate keys', 'error');
      }
    } catch (error) {
      console.error('Failed to generate keys:', error);
      showToast('Failed to generate keys', 'error');
    } finally {
      setGeneratingKeys(false);
    }
  };

  const handleGeneratePsk = async () => {
    setGeneratingPsk(true);
    try {
      const response = await fetch('/api/setup/generate-psk', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setEditingUser({
          ...editingUser,
          presharedKey: data.presharedKey,
        });
        showToast('Preshared key generated successfully!', 'success');
      } else {
        showToast('Failed to generate preshared key', 'error');
      }
    } catch (error) {
      console.error('Failed to generate preshared key:', error);
      showToast('Failed to generate preshared key', 'error');
    } finally {
      setGeneratingPsk(false);
    }
  };

  const handlePrivateKeyChange = async (privateKey: string) => {
    setEditingUser({ ...editingUser, privateKey, publicKey: '' });

    if (!privateKey) {
      return;
    }

    // Derive public key from private key
    try {
      const response = await fetch('/api/setup/derive-public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey }),
      });
      if (response.ok) {
        const data = await response.json();
        setEditingUser(prev => ({ ...prev, publicKey: data.publicKey }));
      }
    } catch (error) {
      console.error('Failed to derive public key:', error);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser || !editingUser.username || !editingUser.serverId) {
      showToast('Username is required', 'error');
      return;
    }

    // Validate keys for new users
    if (!editingUser.id && (!editingUser.privateKey || !editingUser.publicKey)) {
      showToast('Private and public keys are required', 'error');
      return;
    }

    try {
      const payload = {
        username: editingUser.username,
        serverId: editingUser.serverId,
        ipAddress: editingUser.ipAddress || null,
        privateKey: editingUser.privateKey || null,
        publicKey: editingUser.publicKey || null,
        presharedKey: editingUser.presharedKey || null,
        remainingDays: editingUser.remainingDays,
        remainingTrafficGB: editingUser.remainingTrafficGB,
        isEnabled: editingUser.isEnabled,
      };

      const url = editingUser.id ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser.id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        await fetchUsers();
        setIsModalOpen(false);
        setEditingUser(null);

        // Show success message with IP address for new users
        if (!editingUser.id && result.user?.ipAddress) {
          showToast(`User created successfully! VPN IP: ${result.user.ipAddress}`, 'success');
        } else if (editingUser.id) {
          showToast('User updated successfully!', 'success');
        } else {
          showToast('User created successfully!', 'success');
        }
      } else {
        const error = await response.json();
        showToast(`Failed to save user: ${error.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      showToast('Failed to save user. Please try again.', 'error');
    }
  };

  const handleDeleteUser = (user: VPNUser) => {
    setDeletingUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleShowQrCode = async (user: VPNUser) => {
    setQrCodeUser(user);
    setIsQrCodeModalOpen(true);
    setConfigCopied(false);
    setLoadingConfig(true);
    setConfigText('');
    setConfigFileName('');
    setShowConfig(false);

    try {
      const response = await fetch(`/api/users/${user.id}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfigText(data.configText);
        setConfigFileName(data.fileName);
      } else {
        showToast('Failed to load configuration', 'error');
        setConfigText('# Failed to load configuration');
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      showToast('Failed to load configuration', 'error');
      setConfigText('# Failed to load configuration');
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleCopyConfig = async (configText: string) => {
    try {
      await navigator.clipboard.writeText(configText);
      setConfigCopied(true);
      setTimeout(() => setConfigCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('Failed to copy configuration', 'error');
    }
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchUsers();
        setIsDeleteModalOpen(false);
        setDeletingUser(null);
        showToast('User deleted successfully!', 'success');
      } else {
        const error = await response.json();
        showToast(`Failed to delete user: ${error.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      showToast('Failed to delete user. Please try again.', 'error');
    }
  };

  const toggleUserStatus = async (user: VPNUser) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !user.isEnabled }),
      });

      if (response.ok) {
        await fetchUsers();
        showToast(`User ${!user.isEnabled ? 'enabled' : 'disabled'} successfully!`, 'success');
      } else {
        showToast('Failed to update user status', 'error');
      }
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      showToast('Failed to update user status', 'error');
    }
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
      <PageHeader title="VPN Users" />

      {/* Content */}
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">VPN Users</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage VPN user accounts and their access to OpenVPN or WireGuard servers
            </p>
          </div>
          <button
            onClick={handleAddUser}
            disabled={servers.length === 0}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>

        {servers.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
            <Server className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No VPN servers configured</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Please configure at least one server before adding users.
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
            <User className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No VPN users</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Get started by adding your first VPN user.
            </p>
            <button
              onClick={handleAddUser}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4" />
              Add User
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-700" style={{ backgroundColor: '#030712' }}>
            <div className="border-b border-gray-800 bg-gradient-to-r from-gray-800 to-gray-900 p-6">
              <h3 className="text-base font-normal text-white">All Users ({users.length})</h3>
            </div>
            <div
              className="overflow-x-auto"
              style={{
                backgroundColor: '#030712',
                scrollbarWidth: 'thin',
                scrollbarColor: '#374151 #030712'
              }}
            >
              <table className="w-full" style={{ backgroundColor: '#030712' }}>
                  <thead style={{ backgroundColor: '#1f2937' }}>
                    <tr className="border-b border-gray-700">
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-300 dark:text-gray-400">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-300 dark:text-gray-400">
                        IP Address
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-300 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-8 py-3 text-left text-sm font-medium text-gray-300 dark:text-gray-400">
                        Total Usage
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-300 dark:text-gray-400">
                        Remaining Days
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-300 dark:text-gray-400">
                        Remaining Traffic
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-300 dark:text-gray-400">
                        Connection
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-gray-300 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800" style={{ backgroundColor: '#030712' }}>
                    {
                      users.map((user, index) => {
                        const rowBg = index % 2 === 0 ? '#030712' : '#111827';
                        return (
                          <tr
                            key={user.id}
                            className="transition-colors hover:bg-emerald-900/20"
                            style={{ backgroundColor: rowBg }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 dark:bg-gray-800">
                                  <User className="h-5 w-5 text-gray-300 dark:text-gray-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-100 dark:text-gray-100">{user.username}</p>
                                  {user.commonName && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                      CN: {user.commonName}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {user.ipAddress ? (
                                <span className="font-mono text-sm font-medium text-emerald-400 dark:text-emerald-400">
                                  {user.ipAddress}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-500">Not assigned</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => toggleUserStatus(user)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                                  user.isEnabled
                                    ? 'border-emerald-700 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:bg-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                <div className={`h-1.5 w-1.5 rounded-full ${user.isEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                {user.isEnabled ? 'Enabled' : 'Disabled'}
                              </button>
                            </td>
                            <td className="px-8 py-4">
                              <div className="text-sm text-gray-300 dark:text-gray-400">
                                <div>↓ {formatBytes(Number(user.totalBytesReceived) + Number(user.bytesReceived))}</div>
                                <div>↑ {formatBytes(Number(user.totalBytesSent) + Number(user.bytesSent))}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-200 dark:text-gray-200">
                                {user.remainingDays !== null ? `${user.remainingDays} days` : '∞'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-200 dark:text-gray-200">
                                {user.remainingTrafficGB !== null ? `${user.remainingTrafficGB.toFixed(2)} GB` : '∞'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {user.isConnected ? (
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-emerald-400 dark:text-emerald-400" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-200 dark:text-gray-200">Connected</p>
                                    {user.ipAddress && (
                                      <p className="text-xs text-gray-500 dark:text-gray-500">{user.ipAddress}</p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-500">
                                  {user.connectedAt
                                    ? formatDistanceToNow(new Date(user.connectedAt), { addSuffix: true })
                                    : 'Never'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleShowQrCode(user)}
                                  className="rounded-md border border-emerald-700 p-2 text-emerald-400 transition-colors hover:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950"
                                  title="Show QR code"
                                >
                                  <QrCode className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="rounded-md border border-gray-600 p-2 text-gray-300 transition-colors hover:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                                  title="Edit user"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  className="rounded-md border border-red-700 p-2 text-red-400 transition-colors hover:bg-red-950 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                                  title="Delete user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative my-8 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {editingUser.id ? 'Edit User' : 'Add New User'}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {editingUser.id ? 'Update user details and server assignment' : 'Create a new VPN user account'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingUser(null);
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[60vh] space-y-5 overflow-y-auto p-6">
              {/* Username */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username *
                </label>
                <input
                  type="text"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  placeholder="john_doe"
                  disabled={!!editingUser.id}
                />
                {editingUser.id && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Username cannot be changed after creation</p>
                )}
              </div>

              {/* Private Key */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Private Key *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateKeys}
                    disabled={generatingKeys || !!editingUser.id}
                    className="flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900"
                  >
                    {generatingKeys ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Key className="h-3.5 w-3.5" />
                        Generate Keys
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPrivateKey ? 'text' : 'password'}
                    value={editingUser.privateKey || ''}
                    onChange={(e) => handlePrivateKeyChange(e.target.value)}
                    disabled={!!editingUser.id}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-900"
                    placeholder="Enter or generate private key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    {showPrivateKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editingUser.id
                    ? 'Private key cannot be changed after creation'
                    : 'WireGuard private key (auto-generated or manually entered)'}
                </p>
              </div>

              {/* Public Key */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Public Key *
                </label>
                <input
                  type="text"
                  value={editingUser.publicKey || ''}
                  readOnly
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400"
                  placeholder="Derived from private key"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Automatically derived from the private key
                </p>
              </div>

              {/* Preshared Key (Optional) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Preshared Key (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePsk}
                    disabled={generatingPsk || !!editingUser.id}
                    className="flex items-center gap-1.5 rounded-md border border-purple-600 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900"
                  >
                    {generatingPsk ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Key className="h-3.5 w-3.5" />
                        Generate PSK
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPresharedKey ? 'text' : 'password'}
                    value={editingUser.presharedKey || ''}
                    onChange={(e) => !editingUser.id && setEditingUser({ ...editingUser, presharedKey: e.target.value || null })}
                    disabled={!!editingUser.id}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-900"
                    placeholder="Optional: enhanced security with PSK"
                  />
                  {editingUser.presharedKey && (
                    <button
                      type="button"
                      onClick={() => setShowPresharedKey(!showPresharedKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      {showPresharedKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editingUser.id
                    ? 'Preshared key cannot be changed after creation'
                    : 'Optional: Adds an extra layer of symmetric encryption for post-quantum security'}
                </p>
              </div>

              {/* VPN IP Address Field */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  VPN IP Address *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editingUser.ipAddress || ''}
                    onChange={(e) => !editingUser.id && setEditingUser({ ...editingUser, ipAddress: e.target.value })}
                    disabled={!!editingUser.id}
                    placeholder={editingUser.id ? '' : '10.5.10.2'}
                    className={`w-full rounded-lg border px-4 py-3 font-mono text-sm ${
                      editingUser.id
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 cursor-not-allowed'
                        : 'border-gray-300 bg-white text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editingUser.id
                    ? 'IP address cannot be changed after creation'
                    : 'Suggested next available IP. You can modify it if needed.'}
                </p>
              </div>

              {/* Remaining Days */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Remaining Days (Optional)
                </label>
                <input
                  type="number"
                  value={editingUser.remainingDays ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, remainingDays: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Number of days until account expires
                </p>
              </div>

              {/* Remaining Traffic */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Remaining Traffic (GB, Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingUser.remainingTrafficGB ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, remainingTrafficGB: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  placeholder="Leave empty for unlimited"
                  min="0"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Maximum data transfer limit in gigabytes
                </p>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">User Status</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Enable or disable this user</p>
                </div>
                <button
                  onClick={() => setEditingUser({ ...editingUser, isEnabled: !editingUser.isEnabled })}
                  className={`relative h-7 w-14 rounded-full transition-colors ${
                    editingUser.isEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                      editingUser.isEnabled ? 'translate-x-8' : 'translate-x-1'
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
                  setEditingUser(null);
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600"
              >
                {editingUser.id ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete User</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to delete user <strong>{deletingUser.username}</strong>? This action cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeletingUser(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="flex-1 rounded-lg border border-red-600 bg-red-600 px-4 py-2 font-medium text-white transition-all hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {isQrCodeModalOpen && qrCodeUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">VPN Configuration QR Code</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Scan this code or copy the configuration below
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsQrCodeModalOpen(false);
                    setQrCodeUser(null);
                    setConfigCopied(false);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {loadingConfig ? (
                  <div className="flex h-96 items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-emerald-600" />
                      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading configuration...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    {/* User Info */}
                    <div className="mb-6 w-full rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                      <div className="mb-2 flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{qrCodeUser.username}</span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <div>Server: {qrCodeUser.server.name}</div>
                        <div>Protocol: {qrCodeUser.server.protocol.toUpperCase()}</div>
                        {qrCodeUser.ipAddress && <div>IP: {qrCodeUser.ipAddress}</div>}
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="mb-6 rounded-xl bg-white p-6 shadow-lg">
                      <QRCodeSVG
                        value={configText || 'Loading...'}
                        size={256}
                        level="H"
                      />
                    </div>

                    {/* Configuration File */}
                    <div className="w-full">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Configuration File</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{configFileName || 'Loading...'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400">{showConfig ? 'Hide' : 'Show'}</span>
                          <button
                            onClick={() => setShowConfig(!showConfig)}
                            className={`relative h-7 w-14 rounded-full transition-colors ${
                              showConfig ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <div
                              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                                showConfig ? 'translate-x-8' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      {showConfig && (
                        <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => handleCopyConfig(configText)}
                            disabled={!configText}
                            className="absolute right-3 top-3 z-10 rounded bg-gray-800/80 p-1.5 text-gray-400 backdrop-blur-sm transition-colors hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                            title={configCopied ? 'Copied!' : 'Copy to clipboard'}
                          >
                            {configCopied ? (
                              <Check className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <SyntaxHighlighter
                            language="ini"
                            style={customSyntaxTheme}
                            customStyle={{
                              margin: 0,
                              borderRadius: '0.5rem',
                            }}
                            showLineNumbers={true}
                          >
                            {(configText || '# Loading configuration...').trimEnd()}
                          </SyntaxHighlighter>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 dark:border-gray-700">
                <button
                  onClick={() => {
                    setIsQrCodeModalOpen(false);
                    setQrCodeUser(null);
                    setConfigCopied(false);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <ToastProvider>
      <UsersPageContent />
    </ToastProvider>
  );
}
