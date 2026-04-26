import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { verifyPassword } from './password'

export type CredentialCheckResult =
  | { ok: true; user: User }
  | { ok: false; error: string }

/**
 * Single path for username + password checks (login pre-check and NextAuth authorize).
 */
export async function validateUserCredentials(
  username: string,
  password: string,
): Promise<CredentialCheckResult> {
  if (!username?.trim() || !password) {
    return { ok: false, error: 'Username and password are required' }
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
  })

  if (!user) {
    return { ok: false, error: 'Invalid credentials' }
  }

  const passwordOk = await verifyPassword(password, user.password)
  if (!passwordOk) {
    return { ok: false, error: 'Invalid credentials' }
  }

  return { ok: true, user }
}
