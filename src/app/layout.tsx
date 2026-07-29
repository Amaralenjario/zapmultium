import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "ZapMultium - Atendimento WhatsApp",
  description: "Sistema de atendimento multicanal via WhatsApp",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
