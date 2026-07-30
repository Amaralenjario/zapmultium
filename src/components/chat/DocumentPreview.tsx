"use client";

export default function DocumentPreview({ src, name }: { src: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const isPdf = ext === "pdf";
  const isSheet = ["xls", "xlsx", "csv"].includes(ext);
  const isDoc = ["doc", "docx"].includes(ext);
  const isPpt = ["ppt", "pptx"].includes(ext);

  const iconColor = isPdf ? "text-red-500" : isSheet ? "text-green-600" : isPpt ? "text-orange-500" : "text-blue-500";
  const bgColor = isPdf ? "bg-red-50 dark:bg-red-500/10" : isSheet ? "bg-green-50 dark:bg-green-500/10" : isPpt ? "bg-orange-50 dark:bg-orange-500/10" : "bg-blue-50 dark:bg-blue-500/10";
  const label = ext.toUpperCase() || "FILE";

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    const a = document.createElement("a");
    a.href = src;
    a.download = name;
    a.click();
  };

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleDownload}
      className="flex items-center gap-3 px-3 py-2.5 min-w-[220px] max-w-[300px] hover:opacity-90 transition"
    >
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
          <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${bgColor} ${iconColor}`}>{label}</span>
          Documento
        </p>
      </div>
      <div className="w-8 h-8 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
    </a>
  );
}
