import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Ensures the VPN setup UI never renders for anonymous or non-admin users
 * (middleware also enforces this; this blocks RSC/streaming the page shell).
 */
export default async function VpnConfigSetupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/setup/vpn-config")}`);
  }

  if (session.user.role !== "admin") {
    redirect("/login");
  }

  return <>{children}</>;
}
