'use client'

import { useState, Suspense, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

/** Only allow same-origin relative paths (avoid open redirects). */
function safeInternalPath(raw: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  const path = raw.split('?')[0]
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path
}

function LoginForm() {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    otpCode: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requiresOtp, setRequiresOtp] = useState(false)

  useEffect(() => {
    document.title = "Login | NetPlug Dashboard";
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // If OTP is not yet required, check if user needs OTP
      if (!requiresOtp) {
        const checkResponse = await fetch('/api/auth/check-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
          }),
        })

        const checkData = await checkResponse.json()

        if (!checkResponse.ok) {
          setError(checkData.error || 'Invalid username or password')
          setLoading(false)
          return
        }

        if (checkData.requiresOtp) {
          setRequiresOtp(true)
          setLoading(false)
          return
        }
      }

      // Proceed with sign in (with or without OTP)
      const result = await signIn('credentials', {
        username: formData.username,
        password: formData.password,
        otpCode: formData.otpCode,
        redirect: false,
      })

      if (!result || result.error || !result.ok) {
        if (requiresOtp) {
          setError('Invalid OTP code')
        } else {
          setError(result?.error || 'Sign in failed. Check your credentials and try again.')
        }
        setLoading(false)
        return
      }

      let destination = safeInternalPath(searchParams.get('callbackUrl')) || '/dashboard'

      if (destination.startsWith('/setup')) {
        try {
          const statusRes = await fetch('/api/setup/status')
          if (statusRes.ok) {
            const st = await statusRes.json()
            if (st.isSetupComplete) {
              destination = '/dashboard'
            }
          }
        } catch {
          // keep destination
        }
      }

      window.location.assign(destination)
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm">
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
            placeholder="Enter your username"
            required
            disabled={loading}
            autoFocus
          />
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
            placeholder="Enter your password"
            required
            disabled={loading || requiresOtp}
          />
        </div>

        {requiresOtp && (
          <div>
            <label htmlFor="otpCode" className="block text-sm font-medium text-slate-300 mb-2">
              Two-Factor Authentication Code
            </label>
            <input
              type="text"
              id="otpCode"
              value={formData.otpCode}
              onChange={(e) => setFormData({ ...formData, otpCode: e.target.value })}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
              disabled={loading}
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-400">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : requiresOtp ? 'Verify & Sign In' : 'Sign In'}
        </button>

        {requiresOtp && (
          <button
            type="button"
            onClick={() => {
              setRequiresOtp(false)
              setFormData({ ...formData, otpCode: '' })
            }}
            disabled={loading}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
        )}
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <Image
                src="/plug-icon.png"
                alt="NetPlug"
                width={48}
                height={48}
                className="rounded-lg"
              />
              <h1 className="text-3xl font-bold text-white">NetPlug VPN</h1>
            </div>
            <p className="text-slate-400">Sign in to access the dashboard</p>
          </div>

          <Suspense fallback={
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm">
              <div className="text-center text-slate-400">Loading...</div>
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
