export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800/50 rounded-lg" />
        </div>
        <div className="h-10 w-40 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border-t-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-gray-100 dark:bg-gray-800/50 rounded" />
              <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
