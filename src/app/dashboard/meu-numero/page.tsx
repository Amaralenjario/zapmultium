"use client";

import { useEffect, useState } from "react";
import { Smartphone, Info, Globe, MapPin, Mail, Tag, MessageSquareText, BadgeCheck, FileText } from "lucide-react";
import toast from "react-hot-toast";

// Rótulos das categorias (vertical) da API oficial do WhatsApp.
const VERTICALS: Record<string, string> = {
  UNDEFINED: "Não definida", OTHER: "Outro", AUTO: "Automotivo", BEAUTY: "Beleza, spa e salão",
  APPAREL: "Roupas e vestuário", EDU: "Educação", ENTERTAIN: "Entretenimento", EVENT_PLAN: "Eventos e serviços",
  FINANCE: "Finanças e bancos", GROCERY: "Mercado e alimentos", GOVT: "Serviço público", HOTEL: "Hotel e hospedagem",
  HEALTH: "Saúde e medicina", NONPROFIT: "ONG / sem fins lucrativos", PROF_SERVICES: "Serviços profissionais",
  RETAIL: "Varejo / loja", TRAVEL: "Viagens e turismo", RESTAURANT: "Restaurante", NOT_A_BIZ: "Não é uma empresa",
};

interface Channel { phoneId: string; number: string | null; name: string | null; }
interface Profile {
  phoneId: string; number: string | null; name: string | null; profilePicture: string | null;
  about: string; description: string; address: string; email: string; websites: string[]; vertical: string;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-line last:border-0">
      <div className="w-8 h-8 rounded-control bg-surface2 flex items-center justify-center flex-shrink-0 text-tx3">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-tx3">{label}</p>
        <div className={`text-sm mt-0.5 ${empty ? "text-tx3 italic" : "text-tx font-medium"} break-words`}>{empty ? "Não informado" : value}</div>
      </div>
    </div>
  );
}

export default function MeuNumeroPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [p, setP] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (phoneId?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp-profile${phoneId ? `?phoneId=${phoneId}` : ""}`, { cache: "no-store" });
      const d = await res.json();
      setChannels(d.channels || []);
      setP(d.selected || null);
    } catch { toast.error("Erro ao carregar perfil"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-card bg-accentsoft flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-6 h-6 text-accent" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">Meu WhatsApp</h1>
          <p className="text-tx2 text-sm mt-0.5">Seu número e as informações do seu perfil comercial</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-card border border-bd bg-surface h-72 animate-pulse" />
      ) : !p ? (
        <div className="rounded-card border border-bd bg-surface p-10 text-center text-tx3">
          <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
          <p className="font-semibold text-tx2">Nenhum número vinculado à sua conta</p>
          <p className="text-sm mt-1">Peça ao administrador para vincular um número/canal a você.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Seletor de número (se tiver mais de um) */}
          {channels.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {channels.map((c) => (
                <button key={c.phoneId} onClick={() => load(c.phoneId)}
                  className={`px-3 py-1.5 rounded-control text-sm font-bold border transition ${c.phoneId === p.phoneId ? "bg-accentsoft text-accent border-accent/40" : "bg-surface text-tx2 border-bd hover:bg-hover"}`}>
                  {c.number || c.name || c.phoneId}
                </button>
              ))}
            </div>
          )}

          {/* Cartão do número + identidade */}
          <div className="rounded-card border border-bd bg-surface p-5">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {p.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.profilePicture} alt="" className="w-20 h-20 rounded-full object-cover ring-1 ring-bd" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-accentsoft flex items-center justify-center"><Smartphone className="w-8 h-8 text-accent" strokeWidth={1.8} /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-lg font-extrabold text-tx truncate">{p.name || "—"}</p>
                  <BadgeCheck className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={2.2} />
                </div>
                <p className="text-tx2 font-semibold tabular-nums">{p.number || "—"}</p>
                <p className="text-[11px] text-tx3 mt-0.5">Nome e foto vêm do seu WhatsApp Business</p>
              </div>
            </div>
          </div>

          {/* Perfil comercial (somente leitura) */}
          <div className="rounded-card border border-bd bg-surface p-5">
            <h3 className="text-sm font-bold text-tx mb-1">Perfil comercial</h3>
            <div>
              <Row icon={<MessageSquareText className="w-4 h-4" strokeWidth={2} />} label="Sobre" value={p.about} />
              <Row icon={<FileText className="w-4 h-4" strokeWidth={2} />} label="Descrição" value={p.description} />
              <Row icon={<MapPin className="w-4 h-4" strokeWidth={2} />} label="Endereço" value={p.address} />
              <Row icon={<Mail className="w-4 h-4" strokeWidth={2} />} label="E-mail" value={p.email} />
              <Row
                icon={<Globe className="w-4 h-4" strokeWidth={2} />}
                label="Site(s)"
                value={p.websites && p.websites.length > 0 ? (
                  <div className="space-y-0.5">
                    {p.websites.map((w, i) => (
                      <a key={i} href={w} target="_blank" rel="noreferrer" className="block text-accent hover:underline break-all">{w}</a>
                    ))}
                  </div>
                ) : undefined}
              />
              <Row icon={<Tag className="w-4 h-4" strokeWidth={2} />} label="Categoria" value={p.vertical ? (VERTICALS[p.vertical] || p.vertical) : undefined} />
            </div>
          </div>

          {/* Nota */}
          <div className="flex items-start gap-2 rounded-control bg-surface2 border border-line px-3 py-2.5">
            <Info className="w-3.5 h-3.5 text-tx3 mt-0.5 flex-shrink-0" strokeWidth={2} />
            <p className="text-[11px] text-tx3 leading-relaxed">
              Esta tela é somente para <b className="text-tx2">visualização</b>. Para editar o perfil comercial, o nome ou a foto,
              use o app do <b className="text-tx2">WhatsApp Business</b> ou o Gerenciador da Meta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
