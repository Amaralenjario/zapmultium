// Painel do ZapMultium dentro do WhatsApp Web.
// - Detecta AUTOMATICAMENTE o número + nome da conversa aberta (leve, com debounce).
// - Fluxos do vendedor em cache; disparo instantâneo e à prova de duplo-clique.
(function () {
  if (window.__zpxLoaded) return;
  window.__zpxLoaded = true;

  const $ = (sel, root = document) => root.querySelector(sel);
  let cachedFlows = null;

  // ---- Número REAL do lead (funciona com contato salvo) via data-id das mensagens ----
  // Barato de propósito: no máx ~12 elementos, para no 1º válido. Evita varrer o chat todo.
  function numberFromDataId() {
    const els = document.querySelectorAll("#main [data-id]");
    const n = Math.min(els.length, 12);
    for (let i = 0; i < n; i++) {
      const jid = (els[i].getAttribute("data-id") || "").split("_")[1] || "";
      if (jid.endsWith("@c.us")) {
        const d = jid.replace("@c.us", "").replace(/\D/g, "");
        if (d.length >= 10 && d.length <= 15) return d;
      }
    }
    return "";
  }
  function detectChat() {
    const header = $("#main header");
    const titleEl = header?.querySelector("span[title]") || header?.querySelector("span[dir='auto']");
    const name = (titleEl?.getAttribute("title") || titleEl?.textContent || "").trim();
    let phone = numberFromDataId();
    if (!phone) { const d = name.replace(/\D/g, ""); if (d.length >= 10 && d.length <= 15) phone = d; }
    return { phone, name };
  }

  // ---- UI ----
  const panel = document.createElement("div");
  panel.id = "zpx-panel";
  panel.innerHTML = `
    <div id="zpx-fab" title="ZapMultium — disparar fluxo">⚡</div>
    <div id="zpx-card" style="display:none">
      <div class="zpx-head"><span>⚡ ZapMultium</span><button id="zpx-close">✕</button></div>
      <div class="zpx-body">
        <div id="zpx-contact" class="zpx-contact"></div>
        <label class="zpx-lbl">Número do lead</label>
        <input id="zpx-phone" class="zpx-input" placeholder="Abra uma conversa…" />
        <label class="zpx-lbl">Fluxos</label>
        <div id="zpx-flows" class="zpx-flows"><div class="zpx-muted">Carregando…</div></div>
        <div id="zpx-status" class="zpx-status"></div>
      </div>
    </div>`;
  document.body.appendChild(panel);

  const card = $("#zpx-card", panel);
  const phoneInput = $("#zpx-phone", panel);
  const contactEl = $("#zpx-contact", panel);
  const flowsBox = $("#zpx-flows", panel);
  const statusBox = $("#zpx-status", panel);
  const setStatus = (msg, kind) => { statusBox.textContent = msg || ""; statusBox.className = "zpx-status" + (kind ? " " + kind : ""); };

  let currentName = "";
  function syncChat(force) {
    const { phone, name } = detectChat();
    if (name !== currentName || force) {
      currentName = name;
      contactEl.textContent = name ? "Conversa: " + name : "Nenhuma conversa aberta";
      if (document.activeElement !== phoneInput) phoneInput.value = phone;
      setStatus("");
    } else if (phone && document.activeElement !== phoneInput && phoneInput.value !== phone) {
      phoneInput.value = phone; // número apareceu depois (mensagens carregaram)
    }
  }

  $("#zpx-fab", panel).addEventListener("click", () => {
    const open = card.style.display !== "none";
    card.style.display = open ? "none" : "block";
    if (!open) syncChat(true);
  });
  $("#zpx-close", panel).addEventListener("click", () => { card.style.display = "none"; });

  // Observador DEBOUNCED: o WhatsApp Web muda o DOM o tempo todo — sem isso a extensão
  // travava a página. Coalescemos as mudanças e só sincronizamos quando o painel está aberto.
  let syncTimer = null;
  const scheduleSync = () => {
    if (card.style.display === "none" || syncTimer) return;
    syncTimer = setTimeout(() => { syncTimer = null; syncChat(false); }, 400);
  };
  new MutationObserver(scheduleSync).observe(document.body, { subtree: true, childList: true });

  function renderFlows() {
    if (!cachedFlows) { flowsBox.innerHTML = `<div class="zpx-muted">Carregando…</div>`; return; }
    if (cachedFlows.error) { flowsBox.innerHTML = `<div class="zpx-err">${cachedFlows.error}</div>`; return; }
    if (!cachedFlows.length) { flowsBox.innerHTML = `<div class="zpx-muted">Nenhum fluxo.</div>`; return; }
    flowsBox.innerHTML = "";
    for (const f of cachedFlows) {
      const b = document.createElement("button");
      b.className = "zpx-flow"; b.textContent = "▶ " + f.name;
      b.addEventListener("click", () => fire(f, b));
      flowsBox.appendChild(b);
    }
  }
  function loadFlows() {
    chrome.runtime.sendMessage({ type: "flows" }, (resp) => {
      cachedFlows = !resp || resp.error ? { error: (resp && resp.error) || "Erro ao carregar fluxos" } : (resp.flows || []);
      renderFlows();
    });
  }

  // Trava anti-duplo-disparo: cada botão fica bloqueado 2s após clicar (mesmo com resposta instantânea).
  let firing = false;
  function fire(flow, btn) {
    if (firing || btn.disabled) return;
    // Re-detecta o número da conversa ABERTA AGORA (evita disparar pro lead errado quando
    // troca de conversa rápido e o campo ainda não atualizou). Se não há conversa aberta,
    // usa o que está no campo (número digitado na mão).
    const fresh = detectChat().phone;
    if (fresh && document.activeElement !== phoneInput) phoneInput.value = fresh;
    const leadPhone = (fresh || phoneInput.value || "").replace(/\D/g, "");
    if (leadPhone.length < 10 || leadPhone.length > 15) { setStatus("Confira o número do lead.", "err"); return; }
    firing = true; btn.disabled = true;
    setStatus("Disparando “" + flow.name + "”…");
    chrome.runtime.sendMessage({ type: "trigger", leadPhone, flowId: flow.id }, (resp) => {
      firing = false;
      setTimeout(() => { btn.disabled = false; }, 2000); // cooldown por botão
      if (!resp || resp.error) { setStatus((resp && resp.error) || "Erro ao disparar", "err"); return; }
      setStatus(resp.message || "Disparado!", "ok");
    });
  }

  loadFlows();
})();
