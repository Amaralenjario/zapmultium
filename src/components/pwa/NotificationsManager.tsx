"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Check, Smartphone, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

// Converte a chave VAPID (base64url) pro formato que o pushManager espera.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "loading" | "unsupported" | "need-install" | "default" | "denied" | "subscribed";

export default function NotificationsManager() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const isStandalone = () =>
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const refresh = async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      // iOS só suporta Web Push quando o app está INSTALADO (adicionado à Tela de Início)
      if (isIOS() && !isStandalone()) { setState("need-install"); return; }
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") { setState("subscribed"); return; }
    } catch { /* ignore */ }
    setState("default");
  };

  useEffect(() => { refresh(); }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        toast.error(perm === "denied" ? "Permissão negada nas configurações do navegador" : "Permissão não concedida");
        return;
      }
      const { key, enabled } = await fetch("/api/push/public-key").then((r) => r.json());
      if (!enabled || !key) { toast.error("Servidor ainda sem chave de notificação (VAPID). Avise o admin."); return; }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Falha ao salvar"); }
      setState("subscribed");
      toast.success("Notificações ativadas! 🔔");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível ativar");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
      toast.success("Notificações desativadas");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao desativar");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Falha no teste");
      toast.success("Enviado! A notificação deve aparecer em instantes.");
    } catch (err: any) {
      toast.error(err?.message || "Erro no teste");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-bd bg-surface p-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-10 h-10 rounded-xl bg-accentsoft flex items-center justify-center flex-shrink-0">
          <BellRing className="w-5 h-5 text-accent" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-tx">Notificações de leads</h2>
          <p className="text-[12px] text-tx3">Seja avisado na hora que chegar mensagem de um lead — mesmo com o app fechado.</p>
        </div>
      </div>

      <div className="mt-4">
        {state === "loading" && (
          <div className="h-10 rounded-control bg-surface2 animate-pulse" />
        )}

        {state === "unsupported" && (
          <div className="flex items-start gap-2 rounded-control border border-bd bg-surface2 p-3 text-[13px] text-tx2">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" strokeWidth={2} />
            Este navegador não suporta notificações. Use o Chrome (Android/PC) ou instale o app.
          </div>
        )}

        {state === "need-install" && (
          <div className="flex items-start gap-2 rounded-control border border-accent/40 bg-accentsoft p-3 text-[13px] text-tx2">
            <Smartphone className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" strokeWidth={2} />
            <span>No iPhone, as notificações só funcionam com o app <b className="text-tx">instalado</b>. Toque em <b className="text-tx">Instalar app</b> no menu (Compartilhar → Adicionar à Tela de Início), abra pelo ícone e volte aqui.</span>
          </div>
        )}

        {state === "denied" && (
          <div className="flex items-start gap-2 rounded-control border border-red-500/30 bg-red-500/5 p-3 text-[13px] text-tx2">
            <BellOff className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" strokeWidth={2} />
            <span>As notificações estão <b className="text-tx">bloqueadas</b>. Libere no cadeado 🔒 da barra de endereço (ou nas configurações do site) e recarregue a página.</span>
          </div>
        )}

        {state === "default" && (
          <button
            onClick={enable}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-control bg-accent text-white px-4 py-3 text-sm font-bold shadow-glow hover:bg-accent2 transition disabled:opacity-60"
          >
            <Bell className="w-4 h-4" strokeWidth={2.2} /> {busy ? "Ativando…" : "Ativar notificações"}
          </button>
        )}

        {state === "subscribed" && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 rounded-control border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} /> Notificações ativadas neste aparelho
            </div>
            <div className="flex gap-2">
              <button onClick={sendTest} disabled={busy} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx2 hover:bg-hover transition disabled:opacity-60">
                Enviar teste
              </button>
              <button onClick={disable} disabled={busy} className="flex-1 rounded-control border border-bd px-4 py-2.5 text-sm font-semibold text-tx3 hover:text-red-500 hover:border-red-500/40 transition disabled:opacity-60">
                Desativar
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-tx3">
        Dica: ative no celular que você usa pra atender. Cada aparelho precisa ativar uma vez.
      </p>
    </div>
  );
}
