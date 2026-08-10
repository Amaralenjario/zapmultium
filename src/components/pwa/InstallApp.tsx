"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, SquarePlus, MoreVertical, Check } from "lucide-react";

type Platform = "android" | "ios" | "desktop";

// Botão "Instalar app" + instruções por sistema (Android / iOS).
// No Android usa o prompt nativo do navegador; no iOS mostra o passo a passo.
export default function InstallApp({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && "ontouchend" in document);
    const isAndroid = /android/i.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "desktop");

    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setInstalled(!!standalone);

    const onBIP = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setInstalled(true);
      } catch { /* ignore */ }
      setDeferred(null);
      return;
    }
    setOpen(true); // iOS ou navegador sem prompt automático → instruções
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={className || "w-full flex items-center justify-center gap-2 rounded-control bg-accent text-white px-3 py-2 text-[13px] font-bold shadow-glow hover:bg-accent2 transition"}
      >
        <Download className="w-4 h-4" strokeWidth={2.2} /> Instalar app
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-card border border-bd bg-surface shadow-pop p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0"><Download className="w-4 h-4 text-white" strokeWidth={2.2} /></span>
                <h3 className="text-base font-extrabold text-tx">Instalar o app</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-tx3 hover:bg-hover"><X className="w-5 h-5" strokeWidth={2} /></button>
            </div>
            <p className="text-[12px] text-tx3 mb-4">Fica igual um aplicativo, com ícone na tela inicial e tela cheia.</p>

            {/* iOS */}
            <div className={`rounded-control border p-3 mb-2.5 ${platform === "ios" ? "border-accent bg-accentsoft" : "border-bd"}`}>
              <p className="text-[13px] font-bold text-tx mb-1.5">📱 iPhone / iPad (Safari)</p>
              <ol className="text-[12px] text-tx2 space-y-1.5">
                <li className="flex items-start gap-1.5"><Share className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" strokeWidth={2} /> Toque no botão <b className="text-tx">Compartilhar</b> (na barra do Safari).</li>
                <li className="flex items-start gap-1.5"><SquarePlus className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" strokeWidth={2} /> Role e toque em <b className="text-tx">&ldquo;Adicionar à Tela de Início&rdquo;</b>.</li>
                <li className="flex items-start gap-1.5"><Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" strokeWidth={2.5} /> Toque em <b className="text-tx">Adicionar</b>. Pronto!</li>
              </ol>
            </div>

            {/* Android */}
            <div className={`rounded-control border p-3 ${platform === "android" ? "border-accent bg-accentsoft" : "border-bd"}`}>
              <p className="text-[13px] font-bold text-tx mb-1.5">🤖 Android (Chrome)</p>
              <ol className="text-[12px] text-tx2 space-y-1.5">
                <li className="flex items-start gap-1.5"><MoreVertical className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" strokeWidth={2} /> Toque no menu <b className="text-tx">⋮</b> do Chrome (canto superior).</li>
                <li className="flex items-start gap-1.5"><Download className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" strokeWidth={2} /> Toque em <b className="text-tx">&ldquo;Instalar aplicativo&rdquo;</b> (ou &ldquo;Adicionar à tela inicial&rdquo;).</li>
                <li className="flex items-start gap-1.5"><Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" strokeWidth={2.5} /> Confirme em <b className="text-tx">Instalar</b>. Pronto!</li>
              </ol>
            </div>

            <button onClick={() => setOpen(false)} className="w-full mt-4 rounded-control bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent2 transition">Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}
