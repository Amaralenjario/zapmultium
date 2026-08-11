// Painel do ZapMultium dentro do WhatsApp Web.
// - Detecta AUTOMATICAMENTE o número + nome da conversa aberta (atualiza ao trocar de conversa).
// - Fluxos do vendedor carregados uma vez (instantâneo) e disparados pelo motor do ZapMultium.
(function () {
  if (window.__zpxLoaded) return;
  window.__zpxLoaded = true;

  const $ = (sel, root = document) => root.querySelector(sel);
  let cachedFlows = null; // carrega uma vez

  // ---- Detecta número + nome da conversa aberta ----
  // Pega o número REAL do lead mesmo com contato SALVO: toda mensagem tem um data-id no
  // formato `<fromMe>_<numero>@c.us_<id>` — o número da conversa está ali, não depende do nome.
  function numberFromDataId() {
    const els = document.querySelectorAll("#main [data-id]");
    for (const el of els) {
      const id = el.getAttribute("data-id") || "";
      const jid = id.split("_")[1] || "";      // ex.: 5547999999999@c.us  (ignora grupos @g.us)
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
    // 1º tenta o número real via data-id (funciona com contato salvo). 2º cai no título (lead não salvo).
    let phone = numberFromDataId();
    if (!phone) {
      const d = name.replace(/\D/g, "");
      if (d.length >= 10 && d.length <= 15) phone = d;
    }
    return { phone, name };
  }

  // ---- UI ----
  const panel = document.createElement("div");
  panel.id = "zpx-panel";
  panel.innerHTML = `
    <div id="zpx-fab" title="ZapMultium — disparar fluxo">⚡</div>
    <div id="zpx-card" style="display:none">
      <div class="zpx-head">
        <span>⚡ ZapMultium</span>
        <button id="zpx-close">✕</button>
      </div>
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

  // Sincroniza o painel com a conversa aberta (número + nome). Chamado ao trocar de conversa.
  let currentName = "";
  function syncChat(force) {
    const { phone, name } = detectChat();
    if (name !== currentName || force) {
      currentName = name;
      contactEl.textContent = name ? "Conversa: " + name : "Nenhuma conversa aberta";
      if (document.activeElement !== phoneInput) phoneInput.value = phone;
      setStatus("");
    }
  }

  $("#zpx-fab", panel).addEventListener("click", () => {
    const open = card.style.display !== "none";
    card.style.display = open ? "none" : "block";
    if (!open) syncChat(true);
  });
  $("#zpx-close", panel).addEventListener("click", () => { card.style.display = "none"; });

  // Observa a troca de conversa (WhatsApp Web é SPA, não recarrega) e atualiza sozinho.
  const obs = new MutationObserver(() => { if (card.style.display !== "none") syncChat(false); });
  obs.observe(document.body, { subtree: true, childList: true });

  function renderFlows() {
    if (!cachedFlows) { flowsBox.innerHTML = `<div class="zpx-muted">Carregando…</div>`; return; }
    if (cachedFlows.error) { flowsBox.innerHTML = `<div class="zpx-err">${cachedFlows.error}</div>`; return; }
    if (!cachedFlows.length) { flowsBox.innerHTML = `<div class="zpx-muted">Nenhum fluxo.</div>`; return; }
    flowsBox.innerHTML = "";
    for (const f of cachedFlows) {
      const b = document.createElement("button");
      b.className = "zpx-flow";
      b.textContent = "▶ " + f.name;
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

  function fire(flow, btn) {
    const leadPhone = (phoneInput.value || "").replace(/\D/g, "");
    if (leadPhone.length < 10) { setStatus("Abra a conversa do lead (ou confira o número).", "err"); return; }
    btn.disabled = true;
    setStatus("Disparando “" + flow.name + "”…");
    chrome.runtime.sendMessage({ type: "trigger", leadPhone, flowId: flow.id }, (resp) => {
      btn.disabled = false;
      if (!resp || resp.error) { setStatus((resp && resp.error) || "Erro ao disparar", "err"); return; }
      setStatus(resp.message || "Disparado!", "ok");
    });
  }

  // Carrega os fluxos já no início (fica instantâneo quando abrir).
  loadFlows();
})();
