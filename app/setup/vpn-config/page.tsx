'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type SetupMode = 'wizard' | 'upload'

export default function VPNConfigPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [setupMode, setSetupMode] = useState<SetupMode>('wizard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [uploadServerHost, setUploadServerHost] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const [wireGuardEnabled, setWireGuardEnabled] = useState(true)
  const [wireGuardConfig, setWireGuardConfig] = useState({
    // Server Settings
    serverHost: 'vpn.example.com',
    serverPort: '51820',
    serverAddress: '10.8.0.1',
    clientAddressRange: '10.8.0.0/24',

    // Network Settings
    mtu: '1420',
    persistentKeepalive: '25',
    allowedIps: '0.0.0.0/0, ::/0',

    // Advanced
    postUp: 'iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE',
    postDown: 'iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE',
  })

  const [dnsServers, setDnsServers] = useState<string[]>(['1.1.1.1', '1.0.0.1'])
  const [dnsInput, setDnsInput] = useState('')

  const [fwMarkEnabled, setFwMarkEnabled] = useState(false)
  const [fwMark, setFwMark] = useState('-')

  const [keyPair, setKeyPair] = useState({
    privateKey: '',
    publicKey: '',
  })
  const [generatingKeys, setGeneratingKeys] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)

  // Generate keys on component mount
  const generateKeys = async () => {
    setGeneratingKeys(true)
    try {
      const response = await fetch('/api/setup/generate-keys', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        setKeyPair({
          privateKey: data.privateKey,
          publicKey: data.publicKey,
        })
      } else {
        setError(data.error || 'Failed to generate keys')
      }
    } catch (err) {
      setError('Failed to generate keys')
    } finally {
      setGeneratingKeys(false)
    }
  }

  // Generate keys on mount if not already set
  useEffect(() => {
    document.title = "VPN Setup | NetPlug Dashboard";

    if (!keyPair.privateKey) {
      generateKeys()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Derive public key from private key when it changes
  useEffect(() => {
    const derivePublicKey = async () => {
      if (!keyPair.privateKey) {
        return
      }

      try {
        const response = await fetch('/api/setup/derive-public-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privateKey: keyPair.privateKey }),
        })
        const data = await response.json()

        if (response.ok) {
          setKeyPair(prev => ({ ...prev, publicKey: data.publicKey }))
        } else {
          setKeyPair(prev => ({ ...prev, publicKey: '' }))
        }
      } catch (err) {
        setKeyPair(prev => ({ ...prev, publicKey: '' }))
      }
    }

    // Debounce the public key derivation
    const timer = setTimeout(() => {
      derivePublicKey()
    }, 500)

    return () => clearTimeout(timer)
  }, [keyPair.privateKey])

  // Derive client CIDR from server address
  useEffect(() => {
    const deriveClientCIDR = () => {
      const serverAddress = wireGuardConfig.serverAddress
      if (!serverAddress) {
        return
      }

      // Check if it's a valid IPv4 address format
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
      const match = serverAddress.match(ipv4Regex)

      if (match) {
        // Extract the first three octets and create CIDR
        const [, octet1, octet2, octet3] = match
        const clientCIDR = `${octet1}.${octet2}.${octet3}.0/24`
        setWireGuardConfig(prev => ({ ...prev, clientAddressRange: clientCIDR }))
      }
    }

    // Debounce the CIDR derivation
    const timer = setTimeout(() => {
      deriveClientCIDR()
    }, 500)

    return () => clearTimeout(timer)
  }, [wireGuardConfig.serverAddress])

  // DNS server handlers
  const addDnsServer = () => {
    const trimmedInput = dnsInput.trim()
    if (trimmedInput && !dnsServers.includes(trimmedInput)) {
      setDnsServers([...dnsServers, trimmedInput])
      setDnsInput('')
    }
  }

  const removeDnsServer = (index: number) => {
    setDnsServers(dnsServers.filter((_, i) => i !== index))
  }

  const handleDnsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addDnsServer()
    } else if (e.key === 'Backspace' && !dnsInput && dnsServers.length > 0) {
      // Remove last DNS server if input is empty and backspace is pressed
      removeDnsServer(dnsServers.length - 1)
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!uploadServerHost.trim()) {
      setError('Enter the public server hostname or IP (used for client configs).')
      return
    }
    if (!uploadFile) {
      setError('Choose a wg0.conf file to upload.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('serverHost', uploadServerHost.trim())

      const response = await fetch('/api/setup/wg-conf', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to apply configuration')
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    // Validate WireGuard is enabled
    if (!wireGuardEnabled) {
      setError('WireGuard VPN must be enabled')
      return
    }

    // Validate key pair exists
    if (!keyPair.privateKey || !keyPair.publicKey) {
      setError('WireGuard key pair is required')
      return
    }

    setLoading(true)

    try {
      const wireGuardData: any = {
        ...wireGuardConfig,
        enabled: true,
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        dns: dnsServers.join(', '),
      }

      // Only include FwMark if enabled and has a valid value
      if (fwMarkEnabled && fwMark && fwMark !== '-') {
        const fwMarkValue = parseInt(fwMark)
        if (!isNaN(fwMarkValue) && fwMarkValue > 0) {
          wireGuardData.fwMark = fwMarkValue
        }
      }

      const response = await fetch('/api/setup/vpn-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wireGuard: wireGuardData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to save configuration')
        setLoading(false)
        return
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-bold text-white">
            2
          </div>
          <h2 className="text-2xl font-bold text-white">Configure VPN Servers</h2>
        </div>
        <p className="text-slate-400">Set up your WireGuard VPN server connection.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mb-6 flex rounded-lg border border-slate-600 bg-slate-900/40 p-1">
        <button
          type="button"
          onClick={() => {
            setSetupMode('wizard')
            setError('')
          }}
          disabled={loading}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            setupMode === 'wizard'
              ? 'bg-slate-700 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Guided setup
        </button>
        <button
          type="button"
          onClick={() => {
            setSetupMode('upload')
            setError('')
          }}
          disabled={loading}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            setupMode === 'upload'
              ? 'bg-emerald-600/30 text-emerald-200 shadow border border-emerald-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Upload wg0.conf
        </button>
      </div>

      {setupMode === 'upload' ? (
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-6 space-y-5">
            <p className="text-sm text-slate-300">
              Use this only during initial setup. The file is copied to the server data directory as{' '}
              <code className="text-emerald-300/90">wg0.conf</code> and brought up with{' '}
              <code className="text-emerald-300/90">wg-quick</code>. The dashboard will keep this file
              as-is on reload; add or change peers in the file on disk if you manage WireGuard outside
              the wizard.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Public server host
              </label>
              <input
                type="text"
                value={uploadServerHost}
                onChange={(e) => setUploadServerHost(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="vpn.example.com or 203.0.113.10"
                disabled={loading}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-500">
                Hostname or IP clients use to reach this server (not in wg0.conf).
              </p>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-300 mb-2">wg0.conf file</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".conf,text/plain"
                className="hidden"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setUploadFile(f ?? null)
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Choose file
                </button>
                <span className="text-sm text-slate-400 font-mono truncate max-w-full">
                  {uploadFile ? uploadFile.name : 'No file selected'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Applying configuration…' : 'Complete setup with uploaded file'}
          </button>
        </form>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* WireGuard Section */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">WireGuard</h3>
              <p className="text-sm text-slate-400">Configure WireGuard server settings</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={wireGuardEnabled}
                onChange={(e) => setWireGuardEnabled(e.target.checked)}
                className="peer sr-only"
                disabled={loading}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-emerald-500"></div>
            </label>
          </div>

          {wireGuardEnabled && (
            <div className="space-y-6">
              {/* Key Pair */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-emerald-400">Server Key Pair</h4>
                  <button
                    type="button"
                    onClick={generateKeys}
                    disabled={generatingKeys || loading}
                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingKeys ? 'Generating...' : 'Generate New Keys'}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Private Key
                  </label>
                  <div className="relative">
                    <input
                      type={showPrivateKey ? "text" : "password"}
                      value={keyPair.privateKey}
                      onChange={(e) => setKeyPair({ ...keyPair, privateKey: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 pr-12 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm"
                      placeholder="Server private key"
                      required={wireGuardEnabled}
                      disabled={loading || generatingKeys}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                      disabled={loading || generatingKeys}
                    >
                      {showPrivateKey ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Keep this secret and secure</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Public Key
                  </label>
                  <input
                    type="text"
                    value={keyPair.publicKey}
                    readOnly
                    className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-slate-400 placeholder-slate-500 font-mono text-sm cursor-not-allowed"
                    placeholder="Public key will be derived from private key"
                  />
                  <p className="mt-1 text-xs text-slate-500">Automatically derived from private key</p>
                </div>
              </div>

              {/* Server Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-emerald-400">Server Settings</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Server Host
                    </label>
                    <input
                      type="text"
                      value={wireGuardConfig.serverHost}
                      onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, serverHost: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="vpn.example.com"
                      required={wireGuardEnabled}
                      disabled={loading}
                    />
                    <p className="mt-1 text-xs text-slate-500">Public hostname or IP</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Server Port
                    </label>
                    <input
                      type="number"
                      value={wireGuardConfig.serverPort}
                      onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, serverPort: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="51820"
                      min="1"
                      max="65535"
                      required={wireGuardEnabled}
                      disabled={loading}
                    />
                    <p className="mt-1 text-xs text-slate-500">WireGuard listening port</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Server Address
                    </label>
                    <input
                      type="text"
                      value={wireGuardConfig.serverAddress}
                      onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, serverAddress: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="10.8.0.1"
                      required={wireGuardEnabled}
                      disabled={loading}
                    />
                    <p className="mt-1 text-xs text-slate-500">Server IP in VPN network</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Client Address Range
                    </label>
                    <input
                      type="text"
                      value={wireGuardConfig.clientAddressRange}
                      readOnly
                      className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-slate-400 placeholder-slate-500 font-mono text-sm cursor-not-allowed"
                      placeholder="Derived from server address"
                    />
                    <p className="mt-1 text-xs text-slate-500">Automatically derived from server address</p>
                  </div>
                </div>
              </div>

              {/* DNS Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-emerald-400">DNS Settings</h4>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    DNS Servers
                  </label>
                  <div className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 min-h-[42px] flex flex-wrap gap-2 items-center">
                    {dnsServers.map((dns, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-sm text-emerald-300"
                      >
                        {dns}
                        <button
                          type="button"
                          onClick={() => removeDnsServer(index)}
                          disabled={loading}
                          className="ml-1 inline-flex items-center justify-center rounded-full hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={dnsInput}
                      onChange={(e) => setDnsInput(e.target.value)}
                      onKeyDown={handleDnsKeyDown}
                      onBlur={addDnsServer}
                      className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-white placeholder-slate-500 text-sm"
                      placeholder={dnsServers.length === 0 ? "Add DNS server (e.g., 1.1.1.1)" : "Add another..."}
                      disabled={loading}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Press Enter to add DNS servers. Click × to remove.</p>
                </div>
              </div>

              {/* Network Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-emerald-400">Network Settings</h4>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      MTU
                    </label>
                    <input
                      type="number"
                      value={wireGuardConfig.mtu}
                      onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, mtu: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="1420"
                      min="1280"
                      max="1500"
                      disabled={loading}
                    />
                    <p className="mt-1 text-xs text-slate-500">Maximum transmission unit</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Persistent Keepalive
                    </label>
                    <input
                      type="number"
                      value={wireGuardConfig.persistentKeepalive}
                      onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, persistentKeepalive: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="25"
                      min="0"
                      max="3600"
                      disabled={loading}
                    />
                    <p className="mt-1 text-xs text-slate-500">Keepalive interval (seconds)</p>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      &nbsp;
                    </label>
                    <div className="flex items-center h-[42px]">
                      <p className="text-xs text-slate-500">0 = disabled</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Allowed IPs
                  </label>
                  <input
                    type="text"
                    value={wireGuardConfig.allowedIps}
                    onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, allowedIps: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="0.0.0.0/0, ::/0"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-slate-500">Traffic to route through VPN (0.0.0.0/0 = all traffic)</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Firewall Mark (FwMark)
                    </label>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={fwMarkEnabled}
                        onChange={(e) => setFwMarkEnabled(e.target.checked)}
                        className="peer sr-only"
                        disabled={loading}
                      />
                      <div className="peer h-5 w-9 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-emerald-500"></div>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={fwMark}
                    onChange={(e) => setFwMark(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/50"
                    placeholder="-"
                    disabled={!fwMarkEnabled || loading}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Firewall mark for policy routing and QoS (optional)
                  </p>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-emerald-400">Advanced (iptables)</h4>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    PostUp Script
                  </label>
                  <textarea
                    value={wireGuardConfig.postUp}
                    onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, postUp: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-xs"
                    rows={3}
                    placeholder="iptables -A FORWARD -i %i -j ACCEPT"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-slate-500">Commands to run when interface comes up</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    PostDown Script
                  </label>
                  <textarea
                    value={wireGuardConfig.postDown}
                    onChange={(e) => setWireGuardConfig({ ...wireGuardConfig, postDown: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-xs"
                    rows={3}
                    placeholder="iptables -D FORWARD -i %i -j ACCEPT"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-slate-500">Commands to run when interface goes down</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving Configuration...' : 'Complete Setup'}
        </button>
      </form>
      )}
    </div>
  )
}
