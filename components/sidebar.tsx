"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Activity,
  Server,
  Users,
  LogOut,
  Shield,
  FileText,
  Link2,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const navigation: NavigationItem[] = [
  { name: "Overview", href: "/dashboard", icon: Activity },
  { name: "Connections", href: "/dashboard/connections", icon: Link2 },
  { name: "Activity", href: "/dashboard/activity", icon: FileText },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Wireguard", href: "/dashboard/wireguard", icon: Server },
  { name: "Obfuscation", href: "/dashboard/obfuscation", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const savedState = Cookies.get('sidebar-collapsed');
    if (savedState === 'true') {
      setIsCollapsed(true);
    }
    setHasLoaded(true);
    // Enable transitions after a brief delay
    setTimeout(() => {
      setIsReady(true);
    }, 50);
  }, []);

  useEffect(() => {
    if (isReady) {
      Cookies.set('sidebar-collapsed', String(isCollapsed), { expires: 365 });
    }
  }, [isCollapsed, isReady]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
        isReady && "transition-all duration-300",
        !hasLoaded && "hidden",
        isCollapsed ? "w-16" : "w-70"
      )}
      suppressHydrationWarning
    >
      <div className={cn(
        "relative flex h-16 items-center gap-3 border-b border-gray-200 dark:border-gray-800",
        isCollapsed ? "px-3" : "px-6"
      )}>
        {!isCollapsed ? (
          <>
            <Image
              src="/plug-icon.png"
              alt="NetPlug"
              width={40}
              height={40}
              className="rounded-full"
            />
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">NetPlug Dashboard</span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Version 1.0</span>
            </div>
          </>
        ) : (
          <div className="mx-auto">
            <Image
              src="/plug-icon.png"
              alt="NetPlug"
              width={40}
              height={40}
              className="rounded-full"
            />
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2.5 text-sm font-normal transition-colors",
                isActive
                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              {!isCollapsed && item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 px-2 py-3 dark:border-gray-800">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-3 rounded px-3 py-2.5 text-sm font-normal transition-colors",
            pathname === "/dashboard/settings"
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings className="h-4 w-4" strokeWidth={1.5} />
          {!isCollapsed && "Settings"}
        </Link>
      </div>
      <div className="border-t border-gray-200 px-2 py-3 dark:border-gray-800">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-medium text-white">
              {((session?.user as any)?.displayName || session?.user?.name)?.[0]?.toUpperCase() || 'A'}
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-medium text-white">
                {((session?.user as any)?.displayName || session?.user?.name)?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{(session?.user as any)?.displayName || session?.user?.name || 'Admin'}</span>
                {session?.user?.email && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{session.user.email}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300 shrink-0"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
