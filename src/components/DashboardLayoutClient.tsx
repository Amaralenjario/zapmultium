"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import FlowScheduler from "@/components/flows/FlowScheduler";
import GlobalAudioProvider from "@/components/audio/GlobalAudioProvider";

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <GlobalAudioProvider>
    <div className="flex bg-bg h-[100dvh] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-surface border-b border-bd flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-tx2 hover:bg-hover rounded-lg">
            <Menu className="w-6 h-6" strokeWidth={2} />
          </button>
          <span className="text-lg font-extrabold tracking-[-0.03em] text-tx">ZapMultium</span>
        </div>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">{children}</main>
      </div>
      <FlowScheduler />
    </div>
    </GlobalAudioProvider>
  );
}
