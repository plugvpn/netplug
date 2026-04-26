import { prisma } from './prisma'

interface SetupStatus {
  isSetupComplete: boolean
  vpnConfiguration?: any
}

/** Single source of truth row (avoids ambiguous findFirst when multiple rows exist). */
export async function getPrimarySystemConfig() {
  return prisma.systemConfig.findFirst({
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const config = await getPrimarySystemConfig()

  return {
    isSetupComplete: config?.isSetupComplete ?? false,
    vpnConfiguration: config?.vpnConfiguration ?? undefined,
  }
}

/**
 * Always reads the database (no in-memory cache). Used by `proxy.ts` and
 * setup flows so a just-finished setup is not mistaken for incomplete.
 */
export async function isSetupComplete(): Promise<boolean> {
  const config = await prisma.systemConfig.findFirst({
    select: { isSetupComplete: true },
  })
  return config?.isSetupComplete ?? false
}

export async function markSetupComplete(vpnConfiguration: any): Promise<void> {
  const existingConfig = await getPrimarySystemConfig()

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

}

/** @deprecated No in-process cache; kept for call sites that cleared cache after setup. */
export function clearSetupStatusCache(): void {}
