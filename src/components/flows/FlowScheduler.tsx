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

    // Poll every 1 second for precise wait timing
    intervalRef.current = setInterval(poll, 1000);
    poll();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
