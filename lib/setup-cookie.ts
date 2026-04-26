/**
 * Use Secure cookies only when the app is served over HTTPS so plain-HTTP
 * installs (e.g. Docker on a LAN) still accept Set-Cookie from the API.
 */
export function secureSetupCookie(): boolean {
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL || ''
  return url.startsWith('https://')
}
