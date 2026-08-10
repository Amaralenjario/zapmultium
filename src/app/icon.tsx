import { ImageResponse } from "next/og";
import { appIcon } from "@/lib/app-icon";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(appIcon(64), { ...size });
}
