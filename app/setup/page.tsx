'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ToastProvider, useToast } from '@/components/ToastProvider'

function SetupPageContent() {
  const router = useRouter()
  const { showToast } = useToast()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check if admin already exists on mount
  useEffect(() => {
    document.title = "Setup | NetPlug Dashboard";

    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/setup/check-admin')
        const data = await response.json()

        if (data.hasAdmin) {
          // Admin exists, skip to VPN configuration
          router.push('/setup/vpn-config')
        } else {
          setChecking(false)
        }
      } catch (err) {
        console.error('Error checking admin:', err)
        setChecking(false)
      }
    }

    checkAdmin()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create admin user
      const response = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create admin account')
        setLoading(false)
        return
      }

      // Auto-login
      const signInResult = await signIn('credentials', {
        username: formData.username,
        password: formData.password,
        redirect: false,
      })

      if (signInResult?.error) {
        setError('Account created but login failed. Please go to login page.')
        setLoading(false)
        return
      }

      // Show success toast
      showToast('Admin account created successfully!', 'success')

      // Navigate to VPN configuration after a short delay
      setTimeout(() => {
        router.push('/setup/vpn-config')
      }, 1000)
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  // Show loading state while checking
  if (checking) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500"></div>
            <p className="text-slate-400">Checking setup status...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-bold text-white">
            1
          </div>
          <h2 className="text-2xl font-bold text-white">Create Admin Account</h2>
        </div>
        <p className="text-slate-400">Set up your administrator credentials to manage the VPN dashboard</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="admin"
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-slate-500">3-20 characters, alphanumeric and underscores only</p>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="••••••••"
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-slate-500">
            Minimum 8 characters with uppercase, lowercase, and number
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Continue to VPN Configuration'}
        </button>
      </form>
    </div>
  )
}

export default function SetupPage() {
  return (
    <ToastProvider>
      <SetupPageContent />
    </ToastProvider>
  )
}
