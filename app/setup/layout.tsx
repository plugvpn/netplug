import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isSetupComplete } from '@/lib/setup'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Setup - NetPlug VPN Dashboard',
  description: 'Initial setup wizard for NetPlug VPN Dashboard',
}

// Force dynamic rendering since we check database state
export const dynamic = 'force-dynamic';

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if setup is already complete
  const setupComplete = await isSetupComplete()

  if (setupComplete) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl">
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
            <p className="text-slate-400">Welcome to the setup wizard</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
