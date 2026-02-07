import { prisma } from './prisma'

interface SetupStatus {
  isSetupComplete: boolean
  vpnConfiguration?: any
}

// Cache setup status for 5 minutes
let setupStatusCache: { status: SetupStatus; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

export async function getSetupStatus(): Promise<SetupStatus> {
  // Check cache
  if (setupStatusCache && Date.now() - setupStatusCache.timestamp < CACHE_TTL) {
    return setupStatusCache.status
  }

  // Query database
  const config = await prisma.systemConfig.findFirst()

  const status: SetupStatus = {
    isSetupComplete: config?.isSetupComplete ?? false,
    vpnConfiguration: config?.vpnConfiguration ?? undefined,
  }

  // Update cache
  setupStatusCache = {
    status,
    timestamp: Date.now(),
  }

  return status
}

export async function isSetupComplete(): Promise<boolean> {
  const status = await getSetupStatus()
  return status.isSetupComplete
}

export async function markSetupComplete(vpnConfiguration: any): Promise<void> {
  // Check if config already exists
  const existingConfig = await prisma.systemConfig.findFirst()

  if (existingConfig) {
    await prisma.systemConfig.update({
      where: { id: existingConfig.id },
      data: {
        isSetupComplete: true,
        vpnConfiguration,
      },
    })
  } else {
    await prisma.systemConfig.create({
      data: {
        isSetupComplete: true,
        vpnConfiguration,
      },
    })
  }

  // Clear cache
  clearSetupStatusCache()
}

export function clearSetupStatusCache(): void {
  setupStatusCache = null
}
