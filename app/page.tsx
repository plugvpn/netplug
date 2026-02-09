import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "NetPlug Dashboard",
  description: "VPN Server Management Dashboard",
};

export default async function Home() {
  // Check if user is authenticated
  const session = await auth();

  if (session) {
    // User is logged in, redirect to dashboard
    redirect("/dashboard");
  }

  // User not logged in, redirect to login page
  redirect("/login");
}
