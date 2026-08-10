"use client";

import { useEffect, useRef } from "react";

export default function FlowScheduler() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        await fetch("/api/flows/advance", { method: "GET" });
      } catch {}
    };
    // Dispara os fluxos vinculados ao dia (ex.: domingo) quando um cliente manda mensagem.
    const autoScan = async () => {
      try {
        await fetch("/api/flows/auto-scan", { method: "GET" });
      } catch {}
    };

    // Poll every 1 second for precise wait timing
    intervalRef.current = setInterval(poll, 1000);
    poll();
    // Varredura de disparo automático a cada 15s (mais leve).
    autoRef.current = setInterval(autoScan, 15000);
    autoScan();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, []);

  return null;
}
