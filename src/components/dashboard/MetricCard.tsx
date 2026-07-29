interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color: "green" | "blue" | "purple" | "yellow" | "red";
}

const colorMap = {
  green: "from-green-600/20 to-green-600/5 border-green-600/30",
  blue: "from-blue-600/20 to-blue-600/5 border-blue-600/30",
  purple: "from-purple-600/20 to-purple-600/5 border-purple-600/30",
  yellow: "from-yellow-600/20 to-yellow-600/5 border-yellow-600/30",
  red: "from-red-600/20 to-red-600/5 border-red-600/30",
};

const iconBgMap = {
  green: "bg-green-600/20 text-green-400",
  blue: "bg-blue-600/20 text-blue-400",
  purple: "bg-purple-600/20 text-purple-400",
  yellow: "bg-yellow-600/20 text-yellow-400",
  red: "bg-red-600/20 text-red-400",
};

export default function MetricCard({ title, value, subtitle, icon, trend, color }: MetricCardProps) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-6 ${colorMap[color]} relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 -translate-y-4 translate-x-4">
        {icon}
      </div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.value >= 0 ? "text-green-400" : "text-red-400"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl ${iconBgMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
