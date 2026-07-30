interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color: "green" | "blue" | "purple" | "yellow" | "red";
}

const colorMap = {
  green: {
    card: "from-green-50 to-white dark:from-green-600/20 dark:to-green-600/5 border-green-200 dark:border-green-600/30",
    iconBg: "bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400",
  },
  blue: {
    card: "from-blue-50 to-white dark:from-blue-600/20 dark:to-blue-600/5 border-blue-200 dark:border-blue-600/30",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400",
  },
  purple: {
    card: "from-purple-50 to-white dark:from-purple-600/20 dark:to-purple-600/5 border-purple-200 dark:border-purple-600/30",
    iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400",
  },
  yellow: {
    card: "from-yellow-50 to-white dark:from-yellow-600/20 dark:to-yellow-600/5 border-yellow-200 dark:border-yellow-600/30",
    iconBg: "bg-yellow-100 text-yellow-600 dark:bg-yellow-600/20 dark:text-yellow-400",
  },
  red: {
    card: "from-red-50 to-white dark:from-red-600/20 dark:to-red-600/5 border-red-200 dark:border-red-600/30",
    iconBg: "bg-red-100 text-red-600 dark:bg-red-600/20 dark:text-red-400",
  },
};

export default function MetricCard({ title, value, subtitle, icon, trend, color }: MetricCardProps) {
  const c = colorMap[color];
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-6 ${c.card} relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.03] dark:opacity-5 -translate-y-4 translate-x-4">
        {icon}
      </div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.value >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl ${c.iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
