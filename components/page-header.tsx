"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export function PageHeader({ children }: PageHeaderProps) {
  const pathname = usePathname();

  const generateBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean);
    const breadcrumbs = [{ label: "Dashboard", href: "/dashboard" }];

    let currentPath = "/dashboard";
    paths.forEach((path) => {
      if (path === "dashboard") return; // Skip dashboard as it's already added

      currentPath += `/${path}`;
      const label = path
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      breadcrumbs.push({
        label,
        href: currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </div>
      {children && (
        <div className="flex items-center gap-4">
          {children}
        </div>
      )}
    </div>
  );
}
