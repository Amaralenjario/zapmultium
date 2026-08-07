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
