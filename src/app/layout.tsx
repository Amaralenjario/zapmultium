import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
      <body className={`min-h-screen bg-gray-950 text-white antialiased ${inter.variable} font-sans`}>
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
