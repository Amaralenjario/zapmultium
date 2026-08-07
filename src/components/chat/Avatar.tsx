interface AvatarProps {
  name?: string;
  url?: string | null;
  size?: "sm" | "md" | "lg";
}

const boxSize = {
  sm: "w-9 h-9",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const textSize = {
  sm: "text-[12px]",
  md: "text-sm",
  lg: "text-lg",
};

const palette = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
];

function initialsOf(name?: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function colorFor(name?: string) {
  const s = name || "?";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export default function Avatar({ name, url, size = "md" }: AvatarProps) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name || ""}
        title={name}
        className={`${boxSize[size]} rounded-full object-cover flex-shrink-0 ring-1 ring-bd`}
      />
    );
  }
  return (
    <div
      className={`${boxSize[size]} ${textSize[size]} rounded-full flex items-center justify-center flex-shrink-0 font-bold ${colorFor(name)}`}
      title={name}
    >
      {initialsOf(name)}
    </div>
  );
}
