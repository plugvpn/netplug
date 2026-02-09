import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import { verifyPassword } from './password'
import * as OTPAuth from 'otpauth'

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        otpCode: { label: 'OTP Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        }) as any

        if (!user) {
          return null
        }

        const isValidPassword = await verifyPassword(
          credentials.password as string,
          user.password
        )

        if (!isValidPassword) {
          return null
        }

        // Check if OTP is enabled
        if (user.otpEnabled && user.otpSecret) {
          const otpCode = credentials.otpCode as string

          if (!otpCode) {
            return null
          }

          // Verify OTP
          try {
            const totp = new OTPAuth.TOTP({
              secret: OTPAuth.Secret.fromBase32(user.otpSecret),
              algorithm: 'SHA1',
              digits: 6,
              period: 30,
            })

            const isValidOtp = totp.validate({ token: otpCode, window: 1 }) !== null

            if (!isValidOtp) {
              return null
            }
          } catch (error) {
            console.error('OTP verification error:', error)
            return null
          }
        }

        return {
          id: user.id,
          name: user.displayName || user.username,
          email: user.email,
          role: user.role,
          username: user.username,
          displayName: user.displayName,
          otpEnabled: user.otpEnabled,
        } as any
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.email = user.email
        token.role = (user as any).role
        ;(token as any).username = (user as any).username
        ;(token as any).displayName = (user as any).displayName
        ;(token as any).otpEnabled = (user as any).otpEnabled
      }
      // Update token when session is updated
      if (trigger === 'update') {
        const updatedUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        }) as any
        if (updatedUser) {
          token.name = updatedUser.displayName || updatedUser.username
          token.email = updatedUser.email
          ;(token as any).displayName = updatedUser.displayName
          ;(token as any).username = updatedUser.username
          ;(token as any).otpEnabled = updatedUser.otpEnabled
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string
        session.user.email = token.email as string
        session.user.role = token.role as string
        ;(session.user as any).displayName = (token as any).displayName
        ;(session.user as any).username = (token as any).username
        ;(session.user as any).otpEnabled = (token as any).otpEnabled
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
}
