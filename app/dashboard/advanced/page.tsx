import { PageHeader } from "@/components/page-header";

export default function AdvancedPage() {
  return (
    <div className="h-full">
      <PageHeader title="Advanced" />
      <div className="p-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">Advanced configuration coming soon...</p>
        </div>
      </div>
    </div>
  );
}
