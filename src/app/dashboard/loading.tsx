export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800/50 rounded-lg" />
        </div>
        <div className="h-10 w-44 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-3">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800/50 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-72" />
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-72" />
      </div>
    </div>
  );
}
