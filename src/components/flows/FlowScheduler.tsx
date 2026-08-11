"use client";

import { useEffect, useRef } from "react";

export default function FlowScheduler() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBusy = useRef(false);
  const scanBusy = useRef(false);

  useEffect(() => {
    // Trava anti-empilhamento: não dispara um novo advance se o anterior ainda não voltou.
    // Sem isso, com o intervalo curto rodando no navegador de CADA vendedor, os requests
    // se sobrepõem e travam a ferramenta quando há muitos fluxos ativos (uso em escala).
    const poll = async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try { await fetch("/api/flows/advance", { method: "GET" }); } catch {}
      finally { pollBusy.current = false; }
    };
    // Dispara os fluxos vinculados ao dia (ex.: domingo) quando um cliente manda mensagem.
    const autoScan = async () => {
      if (scanBusy.current) return;
      scanBusy.current = true;
      try { await fetch("/api/flows/auto-scan", { method: "GET" }); } catch {}
      finally { scanBusy.current = false; }
    };

    // 2.5s é preciso o suficiente pros delays (um wait de 30s não precisa de 1s de precisão)
    // e reduz MUITO a carga quando há vários vendedores online ao mesmo tempo.
    intervalRef.current = setInterval(poll, 2500);
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
