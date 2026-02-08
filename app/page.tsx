import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isSetupComplete } from "@/lib/setup";

// Force dynamic rendering since we need to check database and cookies
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Check if setup is complete in database
  const setupComplete = await isSetupComplete();

  // If setup is complete but cookie is missing, redirect to a page that will set it
  if (setupComplete) {
    const cookieStore = await cookies();
    const setupCookie = cookieStore.get('setup-complete');

    if (!setupCookie || setupCookie.value !== 'true') {
      // Cookie is missing, set it via API call then redirect
      redirect("/api/setup/verify");
    }

    redirect("/dashboard");
  }

  // Setup not complete, redirect to setup wizard
  redirect("/setup");
}
