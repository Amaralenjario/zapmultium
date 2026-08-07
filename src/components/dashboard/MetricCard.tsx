interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}

export default function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  return (
    <div className="rounded-card border border-bd bg-surface p-5 lg:p-6 shadow-card hover:shadow-pop transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-tx2 mb-2">{title}</p>
          <p className="text-[1.75rem] font-extrabold tracking-[-0.035em] text-tx leading-none mb-1">{value}</p>
          {trend && (
            <p className={`text-xs font-bold mt-0.5 ${trend.value >= 0 ? "text-success" : "text-red-500"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
          <p className="text-[11px] text-tx3 mt-0.5">{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-control bg-accentsoft flex items-center justify-center flex-shrink-0">
          <span className="text-accent">{icon}</span>
        </div>
      </div>
    </div>
  );
}
