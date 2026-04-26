import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/setup",
  "/api/users/by-ip",
] as const;

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function fetchSetupComplete(request: NextRequest): Promise<boolean> {
  try {
    const url = new URL("/api/setup/check-admin", request.nextUrl.origin);
    const res = await fetch(url, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { setupComplete?: boolean };
    return Boolean(data.setupComplete);
  } catch {
    return false;
  }
}

/**
 * Must match how Auth.js names session cookies (see @auth/core init:
 * `useSecureCookies ?? url.protocol === "https:"`). Using NODE_ENV here
 * breaks logins when NODE_ENV=production but the app is served over HTTP
 * (common with Docker / internal networks): the browser gets
 * `authjs.session-token` while proxy looked for `__Secure-authjs.session-token`.
 */
function useSecureCookie(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() === "https";
  }
  return request.nextUrl.protocol === "https:";
}

function getSessionToken(request: NextRequest) {
  return getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: useSecureCookie(request),
  });
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/plug-icon.png"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }
    const token = await getSessionToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. Please login to access this resource." },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/manifest.json") {
    return NextResponse.next();
  }

  const token = await getSessionToken(request);

  if (pathname === "/login") {
    if (token) {
      const setupComplete = await fetchSetupComplete(request);
      return NextResponse.redirect(
        new URL(setupComplete ? "/dashboard" : "/setup/vpn-config", request.url),
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/setup/vpn-config")) {
    if (!token) {
      const callbackUrl = encodeURIComponent(pathname + request.nextUrl.search);
      return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
    }
    const role = (token as { role?: string }).role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (await fetchSetupComplete(request)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/setup")) {
    if (token) {
      const setupComplete = await fetchSetupComplete(request);
      if (setupComplete) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    const callbackUrl = encodeURIComponent(pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }

  const setupComplete = await fetchSetupComplete(request);
  if (!setupComplete) {
    return NextResponse.redirect(new URL("/setup/vpn-config", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|plug-icon.png).*)"],
};
