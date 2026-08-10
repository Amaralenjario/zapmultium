import { ImageResponse } from "next/og";
import { appIcon } from "@/lib/app-icon";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Ícone da tela de início no iOS (Adicionar à Tela de Início).
export default function AppleIcon() {
  return new ImageResponse(appIcon(180), { ...size });
}
