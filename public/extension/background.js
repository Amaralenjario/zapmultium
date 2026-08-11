// Service worker: faz as chamadas à API do ZapMultium.
// (O content script no WhatsApp Web NÃO pode chamar a API por causa do CSP da página —
// por isso as requisições saem daqui, do background, que tem host_permissions.)

const DEFAULT_BASE = "https://zapmultium.vercel.app";

async function getConfig() {
  const { baseUrl, code } = await chrome.storage.sync.get(["baseUrl", "code"]);
  return { baseUrl: (baseUrl || DEFAULT_BASE).replace(/\/+$/, ""), code: code || "" };
}

async function apiFlows() {
  const { baseUrl, code } = await getConfig();
  if (!baseUrl || !code) return { error: "Configure a URL e o código na extensão." };
  try {
    const res = await fetch(`${baseUrl}/api/extension/flows`, { headers: { "x-zpx-key": code } });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Falha ao buscar fluxos" };
    return { flows: data.flows || [] };
  } catch (e) {
    return { error: "Não consegui falar com o sistema (confira a URL)." };
  }
}

async function apiTrigger(leadPhone, flowId, phoneNumberId) {
  const { baseUrl, code } = await getConfig();
  if (!baseUrl || !code) return { error: "Configure a URL e o código na extensão." };
  try {
    const res = await fetch(`${baseUrl}/api/extension/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-zpx-key": code },
      body: JSON.stringify({ lead_phone: leadPhone, flow_id: flowId, phone_number_id: phoneNumberId || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Falha ao disparar", need_phone: data.need_phone, phones: data.phones };
    return data;
  } catch (e) {
    return { error: "Não consegui falar com o sistema (confira a URL)." };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "flows") { apiFlows().then(sendResponse); return true; }
  if (msg?.type === "trigger") { apiTrigger(msg.leadPhone, msg.flowId, msg.phoneNumberId).then(sendResponse); return true; }
  if (msg?.type === "config") { getConfig().then(sendResponse); return true; }
});
