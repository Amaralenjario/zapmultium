"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Search, MessagesSquare, Archive, ArchiveRestore, CheckCheck, Zap, Building2, Tag, Pin, Megaphone, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Avatar from "./Avatar";

export interface Customer {
  name: string;
  phone: string;
  avatar_url: string | null;
  id?: string;
}

export interface Conversation {
  id: string;
  status: string;
  stage?: string; // etapa de atendimento: waiting | attending | resolved
  pinned_at?: string | null;       // fixado no topo (até 10)
  remarketing_at?: string | null;  // marcado p/ remarketing depois (outra cor)
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender?: string | null;
  last_message_read?: boolean | null;
  unread_count: number;
  created_at: string;
  metadata?: Record<string, any>;
  archived?: boolean;
  customer: Customer | Customer[];
}

// Colunas buscadas (reusado na sincronização "ao vivo" e no "carregar mais antigas").
const CONV_SELECT = "id, status, stage, pinned_at, remarketing_at, archived, last_message, last_message_at, last_message_sender, last_message_read, unread_count, created_at, metadata, customer:customer_id(id, name, phone, avatar_url)";
const LIVE_LIMIT = 500; // janela ao vivo (as mais recentes)
const PAGE = 200;       // cada página de "mais antigas" (carrega conforme rola)

// Ordena: FIXADOS no topo (por pinned_at), depois REMARKETING (por remarketing_at),
// depois o resto por atividade. Usado no merge e no realtime pra ficarem iguais.
function convGroup(c: Conversation): number {
  if (c.pinned_at) return 0;
  if (c.remarketing_at) return 1;
  return 2;
}
function compareConvs(a: Conversation, b: Conversation): number {
  const ga = convGroup(a), gb = convGroup(b);
  if (ga !== gb) return ga - gb;
  if (ga === 0) return Date.parse(b.pinned_at!) - Date.parse(a.pinned_at!);
  if (ga === 1) return Date.parse(b.remarketing_at!) - Date.parse(a.remarketing_at!);
  const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
  const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
  return tb - ta;
}

// Une listas por id (a versão nova sobrescreve a antiga) e reordena.
// Assim o polling/realtime atualiza as recentes SEM apagar as páginas antigas já carregadas.
function mergeConvs(prev: Conversation[], incoming: Conversation[]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const c of prev) map.set(c.id, c);
  for (const c of incoming) map.set(c.id, c);
  return Array.from(map.values()).sort(compareConvs);
}

export default function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [phoneMap, setPhoneMap] = useState<Record<string, { name: string; color: string }>>({});
  const [activeFlows, setActiveFlows] = useState<Record<string, { count: number; flowNames: string[] }>>({});
  const [sellerPhoneIds, setSellerPhoneIds] = useState<string[] | null>(null);
  // Ref com o escopo já resolvido (undefined=carregando, null=admin/todos, array=canais do vendedor).
  // Usado pra FILTRAR a query de conversas por canal, senão o limite de 500 pega o pool GLOBAL
  // e o vendedor de alto volume só vê as conversas mais recentes (bug do "só até 11h").
  const sellerPhonesRef = useRef<string[] | null | undefined>(undefined);
  // Aba de etapa selecionada (Aguardando / Atendendo / Resolvidos / Arquivadas)
  const [stageTab, setStageTab] = useState<string>("waiting");
  // Filtro explícito de NÃO LIDAS (modifica a aba atual)
  const [onlyUnread, setOnlyUnread] = useState(false);
  // Menu de botão direito no lead (mudar etapa / fixar / remarketing / etiquetar sem entrar na conversa)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; conv: Conversation } | null>(null);
  const [ctxView, setCtxView] = useState<"menu" | "tags">("menu"); // "tags" = submenu de etiquetas
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [swipedId, setSwipedId] = useState<string | null>(null); // linha aberta por swipe (mobile)
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [operationFilter, setOperationFilter] = useState<string | null>(null);
  const [leadTagsMap, setLeadTagsMap] = useState<Record<string, { id: string; name: string; color: string }[]>>({});
  const [clickLocked, setClickLocked] = useState(false);
  const [permReady, setPermReady] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const supabase = createClient();

  // Espelho do estado pra ler a conversa mais antiga já carregada sem re-render.
  const allConvsRef = useRef<Conversation[]>([]);
  useEffect(() => { allConvsRef.current = allConversations; }, [allConversations]);
  const listRef = useRef<HTMLDivElement>(null);
  // Cursor do polling delta: só busca conversas mudadas DEPOIS disso (não re-busca 500 toda hora).
  const lastSyncRef = useRef<string | null>(null);

  // Aplica o escopo do vendedor (por canal) numa query. Admin/supervisor → sem filtro.
  const applyScope = useCallback((q: any) => {
    const phones = sellerPhonesRef.current;
    if (Array.isArray(phones)) {
      if (phones.length === 0) return q.eq("metadata->>phone_number_id", "__none__");
      if (phones.length === 1) return q.eq("metadata->>phone_number_id", phones[0]);
      return q.or(phones.map((p) => `metadata->>phone_number_id.eq.${p}`).join(","));
    }
    return q;
  }, []);

  // Carrega a próxima página de conversas MAIS ANTIGAS (cursor por last_message_at).
  // Resolve o teto de 500 pra canais de alto volume (o vendedor via "só até tal horário").
  const loadOlder = useCallback(async () => {
    if (loadingOlder || reachedEnd) return;
    const cur = allConvsRef.current;
    const oldest = cur.length ? cur[cur.length - 1].last_message_at : null;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      let q = supabase
        .from("conversations")
        .select(CONV_SELECT)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .lt("last_message_at", oldest)
        .limit(PAGE);
      q = applyScope(q);
      const { data } = await q;
      if (!data || data.length === 0) setReachedEnd(true);
      else {
        setAllConversations((prev) => mergeConvs(prev, data as Conversation[]));
        if (data.length < PAGE) setReachedEnd(true);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, reachedEnd, applyScope, supabase]);

  // Conversas dentro do escopo do vendedor (admin vê todas)
  const scopedConversations = useMemo(() => {
    if (sellerPhoneIds === null) return allConversations;
    return allConversations.filter((conv) => {
      const pid = (conv as any).metadata?.phone_number_id || "";
      if (!pid) return true;
      return sellerPhoneIds.includes(pid);
    });
  }, [allConversations, sellerPhoneIds]);

  // Operações visíveis: só as dos canais do próprio vendedor
  const visibleOps = useMemo(() => {
    const seen: Record<string, { name: string; color: string }> = {};
    for (const [pid, op] of Object.entries(phoneMap)) {
      if (sellerPhoneIds !== null && !sellerPhoneIds.includes(pid)) continue;
      if (!seen[op.name]) seen[op.name] = op;
    }
    return Object.values(seen);
  }, [phoneMap, sellerPhoneIds]);

  // Etiquetas visíveis: só as usadas nas conversas do próprio vendedor
  const availableTags = useMemo(() => {
    const phones = new Set<string>();
    for (const conv of scopedConversations) {
      const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
      if (customer?.phone) phones.add(customer.phone);
    }
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const ph of phones) {
      for (const tag of leadTagsMap[ph] || []) {
        if (!seen.has(tag.id)) seen.set(tag.id, tag);
      }
    }
    return Array.from(seen.values());
  }, [scopedConversations, leadTagsMap]);

  const applyFilters = useCallback(() => {
    // Enquanto a permissão não carregou, não expõe conversa alguma
    if (!permReady) { setConversations([]); return; }

    let filtered = searchResults !== null ? searchResults : allConversations;

    if (sellerPhoneIds !== null) {
      filtered = filtered.filter((conv) => {
        const phoneId = (conv as any).metadata?.phone_number_id || "";
        if (!phoneId) return true;
        return sellerPhoneIds.length > 0 ? sellerPhoneIds.includes(phoneId) : false;
      });
    }

    if (tagFilter) {
      filtered = filtered.filter((conv) => {
        const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
        const phone = customer?.phone || "";
        const tags = leadTagsMap[phone] || [];
        return tags.some((t) => t.id === tagFilter);
      });
    }

    if (operationFilter) {
      filtered = filtered.filter((conv) => {
        const pid = (conv as any).metadata?.phone_number_id || "";
        const op = phoneMap[pid];
        return op ? op.name === operationFilter : false;
      });
    }

    if (search.trim() && searchResults === null) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((conv) => {
        const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
        const name = (customer?.name || "").toLowerCase();
        const phone = (customer?.phone || "").toLowerCase();
        const msg = (conv.last_message || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || msg.includes(q);
      });
    }

    // Aba de etapa (só quando NÃO está buscando — busca mostra todas as etapas).
    if (searchResults === null && !search.trim()) {
      if (stageTab === "archived") filtered = filtered.filter((c) => !!c.archived);
      else filtered = filtered.filter((c) => !c.archived && ((c.stage || "waiting") === stageTab));
    }

    // Filtro explícito de NÃO LIDAS (modifica a aba/busca atual).
    if (onlyUnread) filtered = filtered.filter((c) => c.unread_count > 0);

    setConversations(filtered);
  }, [allConversations, sellerPhoneIds, search, tagFilter, operationFilter, leadTagsMap, searchResults, phoneMap, permReady, stageTab, onlyUnread]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(search.trim())}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { setSearchResults(null); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // full=true → carga inicial (as 500 mais recentes). full=false → DELTA: só as conversas
    // mudadas desde o último sync (barato — normalmente poucas linhas). Isso troca o "re-buscar
    // 500 a cada poll" (que travava a coluna e atrasava o preview) por um fetch minúsculo.
    const applyScopeConv = (q: any) => {
      const phones = sellerPhonesRef.current;
      if (Array.isArray(phones)) {
        if (phones.length === 0) return q.eq("metadata->>phone_number_id", "__none__");
        if (phones.length === 1) return q.eq("metadata->>phone_number_id", phones[0]);
        return q.or(phones.map((p: string) => `metadata->>phone_number_id.eq.${p}`).join(","));
      }
      return q;
    };
    const fetchConversations = async (full = false) => {
      let q = supabase.from("conversations").select(CONV_SELECT);
      if (full || !lastSyncRef.current) {
        q = q.order("last_message_at", { ascending: false, nullsFirst: false }).limit(LIVE_LIMIT);
      } else {
        q = q.gt("updated_at", lastSyncRef.current).order("updated_at", { ascending: false }).limit(200);
      }
      q = applyScopeConv(q);
      const { data } = await q;
      lastSyncRef.current = new Date().toISOString();
      if (data && data.length > 0) {
        setAllConversations((prev) => mergeConvs(prev, data as Conversation[]));
      }
      if (full) { setClickLocked(true); setTimeout(() => setClickLocked(false), 150); }
    };

    const fetchSellerChannels = async () => {
      // Seta o ref (usado na query) e o estado (usado no filtro do cliente) juntos.
      const setScope = (v: string[] | null) => { sellerPhonesRef.current = v; setSellerPhoneIds(v); };
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setScope([]); return; }
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile?.role === "admin" || profile?.role === "supervisor") {
          setScope(null);
          return;
        }
        const { data: sc } = await supabase.from("seller_channels").select("evohub_channel_id").eq("user_id", user.id);
        if (!sc || sc.length === 0) { setScope([]); return; }
        const channelIds = sc.map((s) => s.evohub_channel_id);
        const phoneIdMap: Record<string, string> = {
          "5145a0c0-a358-43e5-8269-c5ace26ca023": "897878513398151",
          "effa72d1-47f6-445b-acbc-7693ef21ee24": "976034132269824",
          "c5505ddf-f9ef-4837-9337-45ed3de40d6a": "892228177298374",
          "346e4eef-bc78-41ec-a7ae-ec7ec75bf177": "1034222499765101",
          "b1c6879b-e962-4f50-95f7-14f1a04601a5": "1234821229708132",
          "0bce92b7-b6a9-4859-ac87-bc2ed01719e1": "1077309398802921",
          "004d0718-04ae-4af5-b55b-aaa5136d1138": "1050317928161978",
        };
        const { data: oc } = await supabase.from("operations_channels").select("evohub_channel_id, phone_number_id").eq("is_active", true);
        for (const row of oc || []) { if (row.phone_number_id) phoneIdMap[row.evohub_channel_id] = row.phone_number_id; }
        setScope(channelIds.map((cid) => phoneIdMap[cid]).filter(Boolean));
      } finally {
        setPermReady(true);
      }
    };

    const fetchOperations = async () => {
      const { data } = await supabase
        .from("operations_channels")
        .select("phone_number_id, operation:operation_id(name, color)")
        .eq("is_active", true)
        .not("phone_number_id", "is", null);
      if (data) {
        const map: Record<string, { name: string; color: string }> = {};
        for (const row of data) {
          const op = Array.isArray(row.operation) ? row.operation[0] : row.operation;
          if (row.phone_number_id && op) map[row.phone_number_id] = { name: op.name, color: op.color };
        }
        setPhoneMap(map);
      }
    };

    const fetchActiveFlows = async () => {
      try {
        const res = await fetch("/api/flows/active");
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, { count: number; flowNames: string[] }> = {};
        const ids: string[] = [];
        for (const item of data) { map[item.conversation_id] = { count: item.count, flowNames: item.flowNames }; ids.push(item.conversation_id); }
        setActiveFlows(map);
        // Garante que conversas COM FLUXO ATIVO estejam na lista (senão o selo ⚡ não tem
        // onde aparecer — ex.: fluxo disparado pela extensão numa conversa fora da janela).
        // Aplica o escopo do vendedor pra não vazar conversa de outro canal.
        const missing = ids.filter((id) => !allConvsRef.current.some((c) => c.id === id));
        if (missing.length > 0) {
          let mq = supabase.from("conversations").select(CONV_SELECT).in("id", missing.slice(0, 50));
          mq = applyScopeConv(mq);
          const { data: convs } = await mq;
          if (convs && convs.length > 0) setAllConversations((prev) => mergeConvs(prev, convs as Conversation[]));
        }
      } catch {}
    };

    const fetchLeadTags = async () => {
      const { data } = await supabase.from("leads").select("phone, lead_tags(tag_id, tag:crm_tags(id, name, color))");
      if (data) {
        const map: Record<string, { id: string; name: string; color: string }[]> = {};
        for (const lead of data) {
          if (lead.phone && lead.lead_tags) {
            const tags = (lead.lead_tags as any[]).filter((lt) => lt.tag).map((lt) => lt.tag);
            if (tags.length > 0) map[lead.phone] = tags;
          }
        }
        setLeadTagsMap(map);
      }
    };

    // Todas as etiquetas do CRM (pro seletor de etiqueta no menu/swipe).
    const fetchAllTags = async () => {
      try { const res = await fetch("/api/crm/tags"); if (res.ok) setAllTags(await res.json()); } catch {}
    };

    // Resolve o escopo do vendedor ANTES da 1ª busca de conversas (pra filtrar pelo canal dele).
    fetchSellerChannels().then(() => fetchConversations(true));
    fetchOperations();
    fetchActiveFlows();
    fetchLeadTags();
    fetchAllTags();

    // Realtime atualiza a LINHA na hora (preview instantâneo) — sem re-buscar 500.
    const channel = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
        const row: any = payload.new;
        setAllConversations((prev) => {
          const i = prev.findIndex((c) => c.id === row.id);
          if (i === -1) return prev; // não é do nosso escopo/janela → o delta pega
          const next = [...prev];
          next[i] = { ...next[i], last_message: row.last_message, last_message_at: row.last_message_at, last_message_sender: row.last_message_sender, last_message_read: row.last_message_read, unread_count: row.unread_count, archived: row.archived, status: row.status, stage: row.stage, pinned_at: row.pinned_at, remarketing_at: row.remarketing_at };
          next.sort(compareConvs);
          return next;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (payload) => {
        // conversa nova → busca ELA (com o cliente) e mescla. Barato (1 linha).
        supabase.from("conversations").select(CONV_SELECT).eq("id", (payload.new as any).id).single()
          .then(({ data }) => { if (data) setAllConversations((prev) => mergeConvs(prev, [data as Conversation])); });
      })
      .subscribe();

    // Poll DELTA a cada 3s (barato — só o que mudou) como rede de segurança do realtime.
    const interval = setInterval(() => fetchConversations(false), 3000);
    const flowInterval = setInterval(fetchActiveFlows, 4000);

    const onFlowTriggered = () => fetchActiveFlows();
    const onLeadTagged = () => fetchLeadTags();
    window.addEventListener("flow-triggered", onFlowTriggered);
    window.addEventListener("lead-tagged", onLeadTagged);

    // Ao voltar o foco, faz um delta na hora (aba em background estrangula o timer).
    const onVisible = () => { if (document.visibilityState === "visible") { fetchConversations(false); fetchActiveFlows(); } };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      clearInterval(flowInterval);
      window.removeEventListener("flow-triggered", onFlowTriggered);
      window.removeEventListener("lead-tagged", onLeadTagged);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const toggleArchive = async (convId: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("conversations").update({ archived: !current }).eq("id", convId);
    setAllConversations((prev) => prev.map((c) => c.id === convId ? { ...c, archived: !current } : c));
  };

  // ── Ações do menu de botão direito ──
  const setStageQuick = async (conv: Conversation, stage: string) => {
    setCtxMenu(null);
    await supabase.from("conversations").update({ stage, updated_at: new Date().toISOString() }).eq("id", conv.id);
    setAllConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, stage } : c).sort(compareConvs));
    const labels: Record<string, string> = { waiting: "Aguardando", attending: "Atendendo", resolved: "Resolvido" };
    toast.success(`Movido pra ${labels[stage] || stage}`);
  };

  const togglePin = async (conv: Conversation) => {
    setCtxMenu(null);
    const isPinned = !!conv.pinned_at;
    if (!isPinned) {
      const count = allConvsRef.current.filter((c) => c.pinned_at).length;
      if (count >= 10) { toast.error("Máximo de 10 leads fixados."); return; }
    }
    const val = isPinned ? null : new Date().toISOString();
    await supabase.from("conversations").update({ pinned_at: val }).eq("id", conv.id);
    setAllConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, pinned_at: val } : c).sort(compareConvs));
    toast.success(isPinned ? "Lead desafixado" : "Lead fixado no topo");
  };

  const toggleRemarketing = async (conv: Conversation) => {
    setCtxMenu(null);
    const val = conv.remarketing_at ? null : new Date().toISOString();
    await supabase.from("conversations").update({ remarketing_at: val }).eq("id", conv.id);
    setAllConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, remarketing_at: val } : c).sort(compareConvs));
    toast.success(conv.remarketing_at ? "Tirado do remarketing" : "Marcado p/ remarketing");
  };

  // Etiqueta a conversa SEM entrar nela: resolve/cria o lead pelo telefone e aplica/remove
  // a etiqueta (mesma lógica do chat). Atualiza leadTagsMap na hora pro selo aparecer.
  const toggleTagOnConv = async (conv: Conversation, tag: { id: string; name: string; color: string }) => {
    const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
    const phone = customer?.phone;
    if (!phone) { toast.error("Lead sem telefone"); return; }
    const phoneNumberId = (conv as any).metadata?.phone_number_id || "";
    const applied = (leadTagsMap[phone] || []).some((t) => t.id === tag.id);
    // Otimista: atualiza o selo na lista na hora.
    setLeadTagsMap((prev) => {
      const cur = prev[phone] || [];
      const next = applied ? cur.filter((t) => t.id !== tag.id) : [...cur, tag];
      return { ...prev, [phone]: next };
    });
    try {
      let { data: lead } = await supabase.from("leads").select("id").eq("phone", phone).maybeSingle();
      if (!lead) {
        const { data: newLead, error } = await supabase.from("leads")
          .insert({ name: customer?.name || phone, phone, status: "new", source: "whatsapp", customer_id: (customer as any)?.id || null, conversation_id: conv.id, metadata: { phone_number_id: phoneNumberId } })
          .select("id").single();
        if (error || !newLead) throw error || new Error("no lead");
        lead = newLead;
      }
      if (applied) {
        await supabase.from("lead_tags").delete().eq("lead_id", lead.id).eq("tag_id", tag.id);
        toast.success("Etiqueta removida");
      } else {
        const res = await fetch(`/api/crm/leads/${lead.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tag_id: tag.id }) });
        if (!res.ok) throw new Error("falha");
        toast.success("Etiqueta aplicada");
      }
      window.dispatchEvent(new CustomEvent("lead-tagged"));
    } catch {
      // desfaz o otimista em erro
      setLeadTagsMap((prev) => {
        const cur = prev[phone] || [];
        const next = applied ? [...cur, tag] : cur.filter((t) => t.id !== tag.id);
        return { ...prev, [phone]: next };
      });
      toast.error("Erro ao etiquetar");
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 7) { const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]; return dias[d.getDay()]; }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  // Abas de etapa de atendimento (filtro no topo, uma etapa por vez).
  const STAGE_TABS = [
    { key: "waiting", label: "Aguardando", active: "bg-amber-500 text-white" },
    { key: "attending", label: "Atendendo", active: "bg-blue-500 text-white" },
    { key: "resolved", label: "Resolvidos", active: "bg-emerald-500 text-white" },
  ] as const;

  // Renderiza uma linha de conversa (reusado na aba e na busca).
  const renderRow = (conv: Conversation) => {
    const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
    const isSelected = selectedId === conv.id;
    const phoneNumberId = (conv as any).metadata?.phone_number_id || "";
    const operation = phoneMap[phoneNumberId];
    const flowInfo = activeFlows[conv.id];
    const customerPhone = customer?.phone || "";
    const tags = leadTagsMap[customerPhone] || [];
    const isFromMe = conv.last_message_sender === "agent" || conv.last_message_sender === "bot";
    // Borda esquerda: fixado (accent) / remarketing (roxo) têm prioridade sobre fluxo/operação.
    const borderColor = conv.pinned_at ? "var(--accent)" : conv.remarketing_at ? "#A855F7" : flowInfo ? "var(--success)" : operation ? operation.color : null;

    return (
      <div key={conv.id} className={`relative overflow-hidden border-b border-line ${conv.archived ? "opacity-60" : ""}`}>
        {/* Ação revelada ao arrastar pro lado (mobile) — Etiquetar */}
        <button
          tabIndex={-1}
          onClick={(e) => { setSwipedId(null); setCtxView("tags"); setCtxMenu({ x: e.clientX - 210, y: e.clientY, conv }); }}
          className="absolute right-0 top-0 bottom-0 w-[104px] bg-accent text-white flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold"
        >
          <Tag className="w-4 h-4" strokeWidth={2.2} />
          Etiquetar
        </button>
        {/* A linha em si — desliza pra revelar a ação; botão direito abre o menu (desktop) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (clickLocked) return; if (swipedId === conv.id) { setSwipedId(null); return; } onSelect(conv); }}
          onContextMenu={(e) => { e.preventDefault(); setCtxView("menu"); setCtxMenu({ x: e.clientX, y: e.clientY, conv }); }}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !clickLocked) { e.preventDefault(); onSelect(conv); } }}
          onTouchStart={(e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={(e) => {
            if (!touchRef.current) return;
            const dx = e.changedTouches[0].clientX - touchRef.current.x;
            const dy = e.changedTouches[0].clientY - touchRef.current.y;
            touchRef.current = null;
            if (dx < -50 && Math.abs(dx) > Math.abs(dy)) setSwipedId(conv.id);   // arrastou pra esquerda → revela
            else if (dx > 30) setSwipedId(null);                                 // arrastou pra direita → fecha
          }}
          className={`w-full flex items-start gap-3 px-3 py-3 cursor-pointer text-left border-l-[3px] group relative ${
            isSelected ? "bg-accentsoft border-l-accent" : "bg-surface border-l-transparent hover:bg-rowhover"
          }`}
          style={{ transform: swipedId === conv.id ? "translateX(-104px)" : "translateX(0)", transition: "transform .2s ease", ...(borderColor && !isSelected ? { borderLeftColor: borderColor } : {}) }}
        >
        <div className="flex-shrink-0 mt-0.5">
          <Avatar name={customer?.name} url={customer?.avatar_url} size="md" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {conv.pinned_at && <Pin className="w-3.5 h-3.5 text-accent flex-shrink-0" fill="currentColor" strokeWidth={2} aria-label="Fixado" />}
              {conv.remarketing_at && <Megaphone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#A855F7" }} strokeWidth={2.2} aria-label="Remarketing" />}
              {operation && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: operation.color }} title={operation.name} />
              )}
              <p className="font-bold text-[15px] text-tx truncate">
                {customer?.name || customer?.phone || "Desconhecido"}
              </p>
              {flowInfo && (
                <span className="flex-shrink-0 flex items-center gap-1 bg-success-soft rounded-full pl-1.5 pr-2 py-0.5" title={`${flowInfo.count} fluxo(s): ${flowInfo.flowNames.join(", ")}`}>
                  <Zap className="w-2.5 h-2.5 text-success animate-pulse" fill="currentColor" strokeWidth={0} />
                  <span className="text-[9px] font-bold text-success truncate max-w-[60px]">{flowInfo.flowNames[0] || ""}</span>
                </span>
              )}
            </div>
            <span className="text-[11px] text-tx3 flex-shrink-0">
              {formatTime(conv.last_message_at || conv.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5 gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isFromMe && conv.last_message_read !== null && (
                <CheckCheck className={`w-3.5 h-3.5 flex-shrink-0 ${conv.last_message_read ? "text-accent" : "text-tx3"}`} strokeWidth={2.2} />
              )}
              <p className="text-[13px] text-tx3 truncate">
                {isFromMe && <span className="text-tx2 font-medium">Você: </span>}
                {conv.last_message || ""}
              </p>
            </div>
            {tags.length > 0 && (
              <div className="flex gap-0.5 flex-wrap flex-shrink-0">
                {tags.slice(0, 2).map((tag) => (
                  <span key={tag.id} className="text-[9px] px-1.5 py-0 rounded-full font-bold" style={{ backgroundColor: tag.color + "20", color: tag.color }}>{tag.name}</span>
                ))}
                {tags.length > 2 && <span className="text-[9px] text-tx3">+{tags.length - 2}</span>}
              </div>
            )}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={(e) => toggleArchive(conv.id, !!conv.archived, e)} className="opacity-0 group-hover:opacity-100 transition p-0.5 text-tx3 hover:text-tx" title={conv.archived ? "Desarquivar" : "Arquivar"}>
                {conv.archived ? <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={2} /> : <Archive className="w-3.5 h-3.5" strokeWidth={2} />}
              </button>
              {conv.unread_count > 0 && (
                <span className="bg-accent text-white text-[11px] font-bold px-1.5 py-0 rounded-full flex-shrink-0 min-w-[20px] h-[20px] flex items-center justify-center">{conv.unread_count}</span>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  };

  // Contagem por etapa (pro badge das abas) — respeita o escopo do vendedor.
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { waiting: 0, attending: 0, resolved: 0, archived: 0, unread: 0 };
    const base = sellerPhoneIds === null ? allConversations : allConversations.filter((conv) => {
      const pid = (conv as any).metadata?.phone_number_id || "";
      return !pid || sellerPhoneIds.includes(pid);
    });
    for (const conv of base) {
      if (conv.archived) { c.archived++; continue; }
      const st = conv.stage === "attending" || conv.stage === "resolved" ? conv.stage : "waiting";
      c[st]++;
      if (conv.unread_count > 0) c.unread++;
    }
    return c;
  }, [allConversations, sellerPhoneIds]);

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3 border-b border-bd">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold tracking-[-0.02em] text-tx">Conversas</h2>
        </div>
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-tx3" strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar conversas..."
            className="w-full pl-9 pr-4 py-2.5 rounded-control bg-surface2 border border-bd text-[14px] text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition"
          />
        </div>
        {permReady && visibleOps.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <Building2 className="w-3.5 h-3.5 text-tx3 flex-shrink-0" strokeWidth={2} aria-label="Operações" />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 min-w-0">
              <button
                onClick={() => setOperationFilter(null)}
                className={`flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full font-bold transition ${!operationFilter ? "bg-accent text-white" : "bg-surface2 text-tx2 hover:bg-hover"}`}
              >
                Todas
              </button>
              {visibleOps.map((op) => (
                <button
                  key={op.name}
                  onClick={() => setOperationFilter(operationFilter === op.name ? null : op.name)}
                  className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full font-bold transition flex items-center gap-1"
                  style={{
                    backgroundColor: operationFilter === op.name ? op.color : op.color + "20",
                    color: operationFilter === op.name ? "#fff" : op.color,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: op.color }} />
                  {op.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {permReady && availableTags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <Tag className="w-3.5 h-3.5 text-tx3 flex-shrink-0" strokeWidth={2} aria-label="Etiquetas" />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 min-w-0">
            <button
              onClick={() => setTagFilter(null)}
              className={`flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full font-bold transition ${!tagFilter ? "bg-accent text-white" : "bg-surface2 text-tx2 hover:bg-hover"}`}
            >
              Todas
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full font-bold transition"
                style={{
                  backgroundColor: tagFilter === tag.id ? tag.color : tag.color + "20",
                  color: tagFilter === tag.id ? "#fff" : tag.color,
                }}
              >
                {tag.name}
              </button>
            ))}
            </div>
          </div>
        )}
        {/* Abas de etapa de atendimento (abaixo dos filtros) */}
        <div className="flex gap-1.5 mt-2.5">
          {STAGE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStageTab(t.key)}
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-control transition ${
                stageTab === t.key ? t.active + " shadow-sm" : "text-tx2 hover:bg-hover hover:text-tx"
              }`}
            >
              {t.label}
              <span className={`ml-1 text-[10px] font-semibold ${stageTab === t.key ? "text-white/80" : "text-tx3"}`}>{permReady ? stageCounts[t.key] : ""}</span>
            </button>
          ))}
          {permReady && stageCounts.archived > 0 && (
            <button
              onClick={() => setStageTab("archived")}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-control transition ${stageTab === "archived" ? "bg-tx2 text-white" : "text-tx3 hover:bg-hover"}`}
              title="Arquivadas"
            >
              <Archive className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
        {/* Filtro explícito de NÃO LIDAS */}
        <div className="flex mt-2">
          <button
            onClick={() => setOnlyUnread((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition ${onlyUnread ? "bg-accent text-white shadow-sm" : "bg-surface2 text-tx2 hover:bg-hover"}`}
            title="Mostrar só as não lidas"
          >
            <span className={`w-2 h-2 rounded-full ${onlyUnread ? "bg-white" : "bg-accent"}`} />
            Só não lidas
            {permReady && <span className={`text-[10px] font-semibold ${onlyUnread ? "text-white/85" : "text-tx3"}`}>{stageCounts.unread}</span>}
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={() => {
          // Perto do fim → carrega a próxima página de antigas (só na lista completa, sem busca).
          if (searchResults !== null || search.trim()) return;
          const el = listRef.current;
          if (!el) return;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 350) loadOlder();
        }}
        className="flex-1 overflow-y-auto"
      >
        {!permReady ? (
          // Enquanto a permissão não carregou, não mostra conversa nenhuma (evita vazar as de outros)
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-surface2 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface2 rounded w-1/2" />
                  <div className="h-2.5 bg-surface2 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-12 text-center text-tx3 text-sm flex flex-col items-center">
            <MessagesSquare className="w-12 h-12 mb-3 opacity-30" strokeWidth={1.5} />
            <p>Nenhuma conversa</p>
          </div>
        ) : (
          // Lista plana da aba selecionada (ou dos resultados de busca).
          conversations.map(renderRow)
        )}

        {/* Rodapé de paginação: carrega mais antigas conforme rola (e botão manual de reserva) */}
        {permReady && searchResults === null && !search.trim() && conversations.length > 0 && (
          <div className="py-3 flex items-center justify-center">
            {loadingOlder ? (
              <span className="flex items-center gap-2 text-[12px] text-tx3">
                <span className="w-3.5 h-3.5 border-[1.5px] border-accent/40 border-t-accent rounded-full animate-spin" />
                Carregando mais…
              </span>
            ) : reachedEnd ? (
              <span className="text-[11px] text-tx3">Você chegou ao fim ✓</span>
            ) : (
              <button onClick={loadOlder} className="text-[12px] font-semibold text-accent hover:underline">
                Carregar conversas mais antigas
              </button>
            )}
          </div>
        )}
      </div>

      {/* Menu de botão direito: mudar etapa / fixar / remarketing sem entrar na conversa */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div
            className="fixed z-50 w-56 rounded-xl bg-surface border border-bd shadow-pop py-1 text-[13px]"
            style={{ top: Math.min(ctxMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 280), left: Math.min(ctxMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 230) }}
          >
            {(() => {
              const c = Array.isArray(ctxMenu.conv.customer) ? ctxMenu.conv.customer[0] : ctxMenu.conv.customer;
              const phone = c?.phone || "";
              const applied = leadTagsMap[phone] || [];
              return (
                <>
                  <div className="px-3 pt-1.5 pb-1 flex items-center gap-1.5">
                    {ctxView === "tags" && (
                      <button onClick={() => setCtxView("menu")} className="text-tx3 hover:text-tx font-bold text-sm leading-none px-0.5" title="Voltar">‹</button>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wide text-tx3 truncate">{ctxView === "tags" ? "Etiquetas" : (c?.name || phone || "Lead")}</span>
                  </div>
                  {ctxView === "menu" ? (
                    <>
                      {([{ k: "waiting", l: "Aguardando", c: "#F59E0B" }, { k: "attending", l: "Atendendo", c: "#3B82F6" }, { k: "resolved", l: "Resolvido", c: "#10B981" }] as const).map((s) => (
                        <button key={s.k} onClick={() => setStageQuick(ctxMenu.conv, s.k)} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-hover transition text-left text-tx font-semibold">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.c }} />
                          {s.l}
                          {(ctxMenu.conv.stage || "waiting") === s.k && <Check className="w-3.5 h-3.5 ml-auto text-tx2" strokeWidth={2.5} />}
                        </button>
                      ))}
                      <div className="my-1 border-t border-bd" />
                      <button onClick={() => { setCtxView("tags"); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-hover transition text-left text-tx font-semibold">
                        <Tag className="w-4 h-4 flex-shrink-0 text-accent" strokeWidth={2} />
                        Etiquetar
                        {applied.length > 0 && <span className="ml-auto text-[10px] text-tx3">{applied.length}</span>}
                      </button>
                      <button onClick={() => togglePin(ctxMenu.conv)} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-hover transition text-left text-tx font-semibold">
                        <Pin className="w-4 h-4 text-accent flex-shrink-0" fill={ctxMenu.conv.pinned_at ? "currentColor" : "none"} strokeWidth={2} />
                        {ctxMenu.conv.pinned_at ? "Desafixar" : "Fixar no topo"}
                      </button>
                      <button onClick={() => toggleRemarketing(ctxMenu.conv)} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-hover transition text-left text-tx font-semibold">
                        <Megaphone className="w-4 h-4 flex-shrink-0" style={{ color: "#A855F7" }} strokeWidth={2} />
                        {ctxMenu.conv.remarketing_at ? "Tirar do remarketing" : "Marcar p/ remarketing"}
                      </button>
                    </>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {allTags.length === 0 ? (
                        <p className="px-3 py-3 text-[12px] text-tx3 text-center">Nenhuma etiqueta criada.</p>
                      ) : allTags.map((t) => {
                        const on = applied.some((x) => x.id === t.id);
                        return (
                          <button key={t.id} onClick={() => toggleTagOnConv(ctxMenu.conv, t)} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-hover transition text-left text-tx font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                            <span className="truncate">{t.name}</span>
                            {on && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" strokeWidth={2.5} style={{ color: t.color }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
