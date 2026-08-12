// SEGURANÇA CONTRA DUPLICATA: só repetir o envio quando temos CERTEZA de que a
// mensagem NÃO foi entregue. Caso ambíguo (a msg pode ter ido e só a resposta se
// perdeu) → NÃO repete, pra nunca mandar duplicada pro cliente.
//
// "Não enviou" com certeza =
//  (a) a Meta REJEITOU explicitamente (131000/2/1/368/131056/190/UNAUTHORIZED) — não gerou msg;
//  (b) o EvoHub falhou na FASE DE CONEXÃO com a Meta (DNS/dial tcp/conn refused) — nunca postou.
// Qualquer timeout de LEITURA ou exceção genérica é ambíguo → não repete.
const META_NOT_SENT_CODES = new Set([131000, 2, 1, 368, 131056, 190]);
const CONNECT_PHASE_RE = /dial tcp|lookup\s|no such host|i\/o timeout|connection refused|econnrefused|enotfound|eai_again|no route to host|network is unreachable|getaddrinfo/i;

export function isAuthWaError(res: { status?: number } | null, data: any): boolean {
  const code = data?.error?.code ?? data?.code;
  const msg = String(data?.error?.message || data?.message || "").toLowerCase();
  return res?.status === 401 || code === "UNAUTHORIZED" || Number(code) === 190 || /unauthor/i.test(msg);
}

// true = seguro repetir (garantidamente NÃO entregou). Default é false (não repete).
export function isRetriableNotSent(res: { status?: number } | null, data: any): boolean {
  const code = data?.error?.code ?? data?.code;
  if (isAuthWaError(res, data)) return true;            // auth rejeitada → não enviou (repete c/ token novo)
  if (META_NOT_SENT_CODES.has(Number(code))) return true; // Meta rejeitou explicitamente → não gerou msg
  const cause = String(data?.error?.cause || "").toUpperCase();
  if (["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(cause)) return true; // não conectou no gateway
  const msg = String(data?.error?.message || data?.message || data?.error?.error_data?.details || "");
  if (CONNECT_PHASE_RE.test(msg)) return true;          // EvoHub não conectou na Meta → não postou
  return false;                                          // ambíguo → NÃO repete (evita duplicar)
}

// Traduz erros da API do WhatsApp/Meta para mensagens amigáveis em PT-BR.
export function friendlyWaError(data: any): string {
  const err = data?.error || data || {};
  const code = err?.code ?? data?.code;
  const detail: string = err?.error_data?.details || err?.message || data?.message || "";

  // Janela de 24h fechada (re-engagement)
  if (code === 131047 || code === 470 || /24\s*h|re-?engag|customer care window|outside the allowed window|last message was more than/i.test(detail)) {
    return "Não enviada: a janela de 24h do WhatsApp fechou. O cliente precisa te mandar uma mensagem antes de você poder responder (ou use um template aprovado).";
  }
  if (code === 131026 || /undeliverable|not a whatsapp user|unable to deliver/i.test(detail)) {
    return "Não enviada: número indisponível no WhatsApp ou não pode receber a mensagem.";
  }
  if (code === 131051 || /unsupported message type/i.test(detail)) {
    return "Não enviada: tipo de mensagem não suportado pelo WhatsApp.";
  }
  if (code === 190 || /access token|expired|session has expired/i.test(detail)) {
    return "Não enviada: token do canal expirado. Reconecte o número nas configurações.";
  }
  if (code === 368 || code === 131056 || /rate limit|too many|temporarily blocked/i.test(detail)) {
    return "Não enviada: limite de mensagens atingido. Aguarde alguns instantes e tente de novo.";
  }
  if (code === 100 || /invalid parameter|param/i.test(detail)) {
    return "Não enviada: dados da mensagem inválidos.";
  }
  return "Não enviada: " + (detail || "erro ao enviar pelo WhatsApp.");
}
