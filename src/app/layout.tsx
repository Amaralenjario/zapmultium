import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import PwaRegister from "@/components/pwa/PwaRegister";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ZapMultium - Atendimento WhatsApp",
  description: "Sistema de atendimento multicanal via WhatsApp",
  manifest: "/manifest.webmanifest",
  applicationName: "ZapMultium",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ZapMultium" },
};

// Trava o zoom do NAVEGADOR — assim a pinça vai pro conteúdo (ex.: canvas dos fluxos)
// em vez de dar zoom na tela toda. Comportamento de app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3A5AF0",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`min-h-screen bg-bg text-tx antialiased ${jakarta.variable} font-sans`}>
        <ThemeProvider>
          <Toaster position="top-right" />
          {children}
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
