"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Plus, Copy, Check, Trash2, Loader2, Terminal, Braces, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

interface ApiKey { id: string; name: string; key: string; is_active: boolean; created_at: string; last_used_at: string | null; }

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); toast.success("Copiado!"); setTimeout(() => setDone(false), 1500); }}
      className="p-1.5 rounded-lg text-tx3 hover:text-accent hover:bg-hover transition flex-shrink-0" title="Copiar"
    >
      {done ? <Check className="w-4 h-4 text-success" strokeWidth={2.4} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
    </button>
  );
}

function Code({ children }: { children: string }) {
  return (
    <div className="relative group">
      <pre className="rounded-control bg-[#0d1220] text-[#d7e0f5] border border-bd p-3.5 pr-10 text-[12px] leading-relaxed overflow-x-auto font-mono whitespace-pre">{children}</pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"><CopyBtn text={children} /></div>
    </div>
  );
}

function Param({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-line last:border-0 text-sm">
      <code className="text-accent font-bold font-mono text-[12px] flex-shrink-0 w-24">{name}</code>
      <span className="text-tx3 text-[11px] font-mono flex-shrink-0 w-16">{type}</span>
      <span className="text-tx2">{desc}</span>
    </div>
  );
}

function Endpoint({ method, path, title, desc, children }: { method: string; path: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-bd bg-surface p-5 scroll-mt-6" id={path.replace(/[^a-z]/gi, "")}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-[11px] font-extrabold uppercase text-success bg-success-soft rounded px-2 py-0.5">{method}</span>
        <code className="font-mono text-sm font-bold text-tx">{path}</code>
      </div>
      <h3 className="font-bold text-tx mt-2">{title}</h3>
      <p className="text-tx2 text-sm mt-0.5 mb-3">{desc}</p>
      {children}
    </div>
  );
}

const PERIODS = "hoje · ontem · 7d · 30d · mes · geral";

export default function ApiDocsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [base, setBase] = useState("/api/public/v1");

  useEffect(() => {
    setBase(window.location.origin + "/api/public/v1");
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try { const r = await fetch("/api/api-keys"); const d = await r.json(); setKeys(d.keys || []); } catch {}
    setLoading(false);
  };

  const create = async () => {
    setCreating(true);
    const r = await fetch("/api/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() || "Chave de API" }) });
    const d = await r.json();
    setCreating(false);
    if (!r.ok) { toast.error(d.error || "Erro"); return; }
    setNewName(""); toast.success("Chave criada!"); load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Excluir esta chave? Integrações que a usam vão parar de funcionar.")) return;
    const r = await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
    if (!r.ok) { toast.error("Erro ao excluir"); return; }
    toast.success("Chave excluída"); load();
  };

  const sampleKey = keys[0]?.key || "zap_live_xxxxxxxxxxxxxxxxxxxx";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link href="/dashboard/operacoes" className="inline-flex items-center gap-1.5 text-sm text-tx2 hover:text-tx mb-4 transition">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Voltar para Operações
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-card bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center shadow-glow flex-shrink-0">
          <Braces className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx">API</h1>
          <p className="text-tx2 text-sm mt-0.5">Puxe todas as métricas — leads, vendas, ranking, Lobo/Rainha, desempenho — via REST</p>
        </div>
      </div>

      {/* Chaves */}
      <div className="rounded-card border border-bd bg-surface p-5 mt-6">
        <h2 className="text-sm font-bold text-tx flex items-center gap-2 mb-1"><KeyRound className="w-4 h-4 text-accent" strokeWidth={2} /> Chaves de API</h2>
        <p className="text-tx3 text-xs mb-4">Cada chave dá acesso de leitura a todos os endpoints. Guarde com cuidado e revogue se vazar.</p>
        <div className="flex gap-2 mb-4">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da chave (ex.: Dashboard Externo)"
            className="flex-1 rounded-control border border-bd bg-surface2 px-3.5 py-2 text-sm text-tx placeholder:text-tx3 focus:border-accent focus:outline-none" />
          <button onClick={create} disabled={creating} className="rounded-control bg-accent px-4 py-2 text-sm font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 transition flex items-center gap-1.5">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} /> : <Plus className="w-4 h-4" strokeWidth={2.2} />} Gerar chave
          </button>
        </div>
        {loading ? (
          <div className="h-16 rounded-control bg-surface2 animate-pulse" />
        ) : keys.length === 0 ? (
          <p className="text-sm text-tx3 text-center py-4">Nenhuma chave ainda. Gere a primeira acima.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-2 rounded-control border border-bd bg-surface2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-tx truncate">{k.name}</p>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[11px] font-mono text-tx2 truncate">{k.key}</code>
                    <CopyBtn text={k.key} />
                  </div>
                  <p className="text-[10px] text-tx3">Criada {new Date(k.created_at).toLocaleDateString("pt-BR")} · {k.last_used_at ? `último uso ${new Date(k.last_used_at).toLocaleString("pt-BR")}` : "nunca usada"}</p>
                </div>
                <button onClick={() => revoke(k.id)} className="p-2 rounded-lg text-tx3 hover:text-red-500 hover:bg-red-500/10 transition flex-shrink-0" title="Excluir"><Trash2 className="w-4 h-4" strokeWidth={2} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Autenticação */}
      <div className="rounded-card border border-bd bg-surface p-5 mt-5">
        <h2 className="text-sm font-bold text-tx flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-accent" strokeWidth={2} /> Autenticação</h2>
        <p className="text-tx2 text-sm mb-3">Envie a chave no header <code className="text-accent font-mono text-[12px]">Authorization</code>. Todas as respostas são JSON.</p>
        <Code>{`Base URL:  ${base}\n\nAuthorization: Bearer ${sampleKey}`}</Code>
        <p className="text-tx3 text-xs mt-2">Também aceita o header <code className="font-mono">x-api-key: SUA_CHAVE</code> ou <code className="font-mono">?api_key=SUA_CHAVE</code> na URL.</p>
      </div>

      {/* Parâmetros comuns */}
      <div className="rounded-card border border-bd bg-surface p-5 mt-5">
        <h2 className="text-sm font-bold text-tx flex items-center gap-2 mb-2"><Terminal className="w-4 h-4 text-accent" strokeWidth={2} /> Parâmetros de período</h2>
        <p className="text-tx2 text-sm mb-2">A maioria dos endpoints aceita <code className="text-accent font-mono text-[12px]">?period=</code>:</p>
        <Param name="period" type="string" desc={`Um de: ${PERIODS}. Padrão: hoje.`} />
        <Param name="start" type="date" desc="Início (YYYY-MM-DD). Se enviar start e end, o período vira personalizado." />
        <Param name="end" type="date" desc="Fim (YYYY-MM-DD)." />
      </div>

      <h2 className="text-lg font-extrabold text-tx mt-8 mb-3 tracking-[-0.02em]">Endpoints</h2>
      <div className="space-y-4">
        <Endpoint method="GET" path="/operations" title="Operações" desc="Lista as operações e a contagem de números (total e ativos).">
          <Code>{`curl "${base}/operations" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "operations": [
    { "id": "...", "nome": "Caio Martins", "slug": "caio", "cor": "#06b6d4",
      "numeros": 3, "numeros_ativos": 3 }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/overview" title="Visão geral" desc="Resumo completo do período: leads, vendas, conversas, mensagens, tempo de resposta e fluxos.">
          <Code>{`curl "${base}/overview?period=mes" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "periodo": { "tipo": "mes", "inicio": "2026-08-01", "fim": "2026-08-09" },
  "leads": { "total": 2530, "novos_no_periodo": 410, "convertidos_no_periodo": 75 },
  "vendas": { "total": 75, "faturamento": 19993.30 },
  "conversas": { "novas": 820, "ativas_agora": 12, "aguardando_resposta": 3, "atendidas": 640 },
  "mensagens": { "enviadas": 15240, "recebidas": 9310 },
  "tempo_resposta": { "mediana_seg": 42, "medio_seg": 88 },
  "duracao_media_conversa_seg": 3600,
  "fluxos": { "disparados": 560, "concluidos": 540, "erros": 4 }
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/leads" title="Leads" desc="Total de leads, novos e convertidos no período, e distribuição por status/coluna do CRM.">
          <Code>{`curl "${base}/leads?period=7d" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "periodo": { "tipo": "7d", "inicio": "2026-08-03", "fim": "2026-08-09" },
  "total": 2530,
  "novos_no_periodo": 180,
  "convertidos_no_periodo": 26,
  "por_status": { "new": 2100, "contacted": 210, "qualified": 120, "converted": 75, "lost": 25 }
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/sellers" title="Desempenho dos vendedores" desc="Por vendedor: atendimento (novas, enviadas, recebidas), vendas, faturamento e taxa de conversão. Ordenado por vendas.">
          <Code>{`curl "${base}/sellers?period=mes" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "periodo": { "tipo": "mes", "inicio": "2026-08-01", "fim": "2026-08-09" },
  "total_vendedores": 8,
  "vendedores": [
    { "vendedor": "Luiz Felipe", "operacao": "Gustavo", "avatar": null,
      "novas": 851, "enviadas": 12457, "recebidas": 6855,
      "vendas": 164, "faturamento": 38210.00, "taxa_conversao_pct": 19 }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/ranking" title="Ranking + Lobo/Rainha do X1" desc="Ranking de vendas por operação no período, e o campeão do mês passado (Lobo = homem, Rainha = mulher). Filtre com ?operation=Nome.">
          <Code>{`curl "${base}/ranking?period=mes" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "periodo": { "tipo": "mes", "inicio": "2026-08-01", "fim": "2026-08-09" },
  "mes_do_campeao": "julho",
  "operacoes": [
    {
      "operation": "Jessica",
      "title": "rainha",
      "champion": { "name": "Gabriela Marinho", "genero": "F",
                    "vendas": 164, "faturamento": 33596, "mes": "julho" },
      "ranking": [
        { "rank": 1, "name": "Gabriela Marinho", "operation": "Jessica",
          "genero": "F", "vendas": 14, "faturamento": 3062.80 }
      ],
      "total_vendas": 28, "total_faturamento": 6120.50
    }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/team" title="Equipe (vendedores completos)" desc="Todos os vendedores com operação, gênero (Lobo/Rainha), foto, meta, telefone, comissão e as vendas no período.">
          <Code>{`curl "${base}/team?period=mes" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "total": 11,
  "equipe": [
    { "utm": "LF", "nome": "Luiz Felipe", "operacao": "Gustavo", "genero": "M",
      "titulo": "lobo", "avatar": null, "meta": 1000, "telefone": null,
      "comissao_pct": null, "ativo": true, "vendas": 33, "faturamento": 7658.60 }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/sales" title="Vendas detalhadas (paginado)" desc="Cada venda individual. Filtros: evento (purchase_approved | refund | chargeback | all), utm, limit (máx 500), offset.">
          <Code>{`curl "${base}/sales?period=mes&limit=50&evento=purchase_approved" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "total": 90, "limit": 50, "offset": 0,
  "vendas": [
    { "id": 12841, "produto": "INSTALADOR ROBÔ PRONTO 2.0", "valor": 497,
      "evento": "purchase_approved", "data": "2026-08-07", "utm": "DG",
      "operacao": "Caio", "tipo_produto": "main", "plataforma": null,
      "campanha": "", "referencia": "...", "cliente": "...", "email": "...", "telefone": "..." }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/sales/summary" title="Resumo de vendas" desc="Faturamento, ticket médio, reembolsos/chargebacks, top produtos, e distribuição por plataforma, campanha, operação e por dia.">
          <Code>{`curl "${base}/sales/summary?period=mes" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "por_evento": { "purchase_approved": 90 },
  "aprovadas": 90, "reembolsos": 0, "chargebacks": 0,
  "faturamento": 23227.00, "ticket_medio": 258.08,
  "top_produtos":   [ { "produto": "...", "vendas": 31, "faturamento": 7903 } ],
  "por_plataforma": [ { "plataforma": "...", "vendas": 90, "faturamento": 23227 } ],
  "por_campanha":   [ { "campanha": "...", "vendas": 12, "faturamento": 2900 } ],
  "por_operacao":   [ { "operacao": "Caio", "vendas": 40, "faturamento": 9800 } ],
  "por_dia":        [ { "dia": "2026-08-03", "vendas": 26, "faturamento": 5574.80 } ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/conversations" title="Conversas (paginado)" desc="Conversas com cliente, telefone, operação, status e última mensagem. Filtros: status, limit (máx 200), offset.">
          <Code>{`curl "${base}/conversations?period=hoje&status=active&limit=50" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "total": 201, "limit": 50, "offset": 0,
  "conversas": [
    { "id": "...", "status": "active", "origem": "whatsapp",
      "cliente": "Leticya Azevedo", "telefone": "556292539145",
      "operacao": "CAIO MARTINS", "ultima_mensagem": "...", "ultimo_remetente": "customer",
      "ultima_mensagem_em": "...", "nao_lidas": 0, "criada_em": "..." }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/leads/list" title="Leads detalhados (paginado)" desc="Cada lead com nome, telefone, email, status, etapa do funil, prioridade e datas. Filtros: status, source, limit (máx 200), offset.">
          <Code>{`curl "${base}/leads/list?period=30d&status=new&limit=50" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "total": 17, "limit": 50, "offset": 0,
  "leads": [
    { "id": "...", "nome": "Anna Bueno", "telefone": "5519995235585",
      "email": null, "origem": "whatsapp", "status": "new", "etapa_funil": "captura",
      "prioridade": "normal", "contatado_em": null, "convertido_em": null,
      "criado_em": "...", "atualizado_em": "..." }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/tags" title="Colunas e etiquetas do CRM" desc="Estrutura do funil: colunas (etapas) e etiquetas, cada uma com a contagem de leads.">
          <Code>{`curl "${base}/tags" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "colunas": [ { "key": "new", "label": "Novos", "cor": "#3b82f6", "posicao": 0, "leads": 17 } ],
  "etiquetas": [ { "id": "...", "nome": "Quente", "cor": "#ef4444", "coluna": "qualified", "leads": 12 } ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/channels" title="Canais / números" desc="Números de WhatsApp por operação, com status de conexão.">
          <Code>{`curl "${base}/channels" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "total": 7,
  "canais": [
    { "canal_id": "...", "nome": "AMANDA - JÉ", "phone_number_id": "1034222499765101",
      "operacao": "JÉSSICA", "cor_operacao": "#8b5cf6", "status": "conectado", "ativo": true }
  ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/flows" title="Fluxos + execuções" desc="Lista de fluxos (nome, status, gatilho) e o resumo de execuções no período por status.">
          <Code>{`curl "${base}/flows?period=mes" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{
  "total_fluxos": 571,
  "execucoes_no_periodo": { "total": 3260, "por_status": { "completed": 3210, "error": 11 } },
  "fluxos": [ { "id": "...", "nome": "[ZV] 04 — Minicurso", "status": "active",
                "gatilho": "manual", "gatilho_valor": null, "criado_em": "..." } ]
}`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/timeseries" title="Séries temporais" desc="metric=messages (enviadas/recebidas por hora ou dia) ou metric=sales (vendas/faturamento por dia).">
          <Code>{`curl "${base}/timeseries?metric=sales&period=mes" \\\n  -H "Authorization: Bearer ${sampleKey}"\n\ncurl "${base}/timeseries?metric=messages&period=7d&bucket=day" \\\n  -H "Authorization: Bearer ${sampleKey}"`}</Code>
          <p className="text-[11px] text-tx3 mt-2 mb-1 font-bold uppercase">Resposta</p>
          <Code>{`{ "metric": "sales", "serie": [ { "dia": "2026-08-03", "vendas": 26, "faturamento": 5574.80 } ] }
{ "metric": "messages", "bucket": "day", "serie": [ { "momento": "...", "enviadas": 120, "recebidas": 88 } ] }`}</Code>
        </Endpoint>
      </div>

      <p className="text-center text-xs text-tx3 mt-8">
        Respostas em JSON · dados de leitura · CORS liberado. Dúvidas de integração? Fale com o suporte.
      </p>
    </div>
  );
}
