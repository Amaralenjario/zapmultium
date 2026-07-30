"use client";

import { useEffect, useRef } from "react";

export default function FlowScheduler() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        await fetch("/api/flows/advance", { method: "GET" });
      } catch {}
    };

    // Poll every 10 seconds for expired wait nodes
    intervalRef.current = setInterval(poll, 10_000);
    poll();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
