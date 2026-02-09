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
  Network,
  Shield,
  FileText,
  Link2,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

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
  { name: "Routing", href: "/dashboard/setup/routing", icon: Network },
  { name: "Obfuscation", href: "/dashboard/obfuscation", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="flex h-full w-70 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6 dark:border-gray-800">
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
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-medium text-white">
              {session?.user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{session?.user?.name || 'Admin'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
