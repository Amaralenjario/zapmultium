import { ImageResponse } from "next/og";
import { appIcon } from "@/lib/app-icon";

export const runtime = "edge";

// Ícones PNG do manifest (qualquer tamanho): /icons/192, /icons/512, etc.
export function GET(_req: Request, { params }: { params: { size: string } }) {
  const n = Math.min(512, Math.max(48, parseInt(params.size, 10) || 192));
  return new ImageResponse(appIcon(n), { width: n, height: n });
}
