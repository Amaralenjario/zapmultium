export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800/50 rounded-lg" />
        </div>
        <div className="h-10 w-40 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900">
          <div className="flex gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-100 dark:border-gray-800/50 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
