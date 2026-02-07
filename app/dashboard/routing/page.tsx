"use client";

import { PageHeader } from "@/components/page-header";
import { Network } from "lucide-react";

export default function RoutingPage() {
  return (
    <div className="h-full">
      <PageHeader title="Routing" />

      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Routing Configuration</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Configure network routing rules and traffic management
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Network className="h-5 w-5" strokeWidth={1.5} />
            <p className="text-sm">
              Routing configuration will be available here soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
