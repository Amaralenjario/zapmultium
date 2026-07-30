export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800/50 rounded-lg" />
        </div>
        <div className="h-10 w-44 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-gray-100 dark:bg-gray-800/50 rounded" />
              <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-800/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
