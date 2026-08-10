"use client";

import { useEffect } from "react";

// Registra o service worker (necessário pra o navegador oferecer "Instalar app").
export default function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
