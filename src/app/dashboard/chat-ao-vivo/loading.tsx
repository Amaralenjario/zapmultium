export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800/50 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="w-[400px] flex-shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-[calc(100vh-12rem)]">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800/50">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-3 w-40 bg-gray-100 dark:bg-gray-800/50 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 h-[calc(100vh-12rem)] flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
