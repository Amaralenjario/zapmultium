export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-surface2 rounded-lg" />
          <div className="h-4 w-28 bg-surface2 rounded-lg" />
        </div>
        <div className="h-10 w-40 bg-surface2 rounded-control" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-card border border-bd bg-surface p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-control bg-surface2" />
              <div className="h-4 w-24 bg-surface2 rounded" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-surface2 rounded" />
              <div className="h-3 w-2/3 bg-surface2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
