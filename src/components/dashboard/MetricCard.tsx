interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}

export default function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-emerald-950/40 bg-white dark:bg-gray-900 p-5 lg:p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{title}</p>
          <p className="text-[1.75rem] font-bold text-gray-900 dark:text-white leading-none mb-1">{value}</p>
          {trend && (
            <p className={`text-xs font-medium mt-0.5 ${trend.value >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-500 dark:text-emerald-400">{icon}</span>
        </div>
      </div>
    </div>
  );
}
