import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Check if the request is authenticated
 * Returns the session if authenticated, or a 401 error response if not
 */
export async function requireAuth() {
  const session = await auth();

  if (!session || !session.user) {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: "Unauthorized. Please login to access this resource." },
        { status: 401 }
      ),
    };
  }

  return {
    authenticated: true,
    session,
  };
}

/**
 * Check if the user has admin role
 */
export async function requireAdmin() {
  const authResult = await requireAuth();

  if (!authResult.authenticated) {
    return authResult;
  }

  const session = authResult.session!;

  if (session.user.role !== "admin") {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      ),
    };
  }

  return {
    authenticated: true,
    session,
  };
}
