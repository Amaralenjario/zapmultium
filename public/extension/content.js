// Painel do ZapMultium dentro do WhatsApp Web.
// - Detecta o número da conversa aberta (com campo editável de segurança).
// - Lista os fluxos do vendedor e dispara pelo motor do ZapMultium (via background).
(function () {
  if (window.__zpxLoaded) return;
  window.__zpxLoaded = true;

  const $ = (sel, root = document) => root.querySelector(sel);

  // ---- Detecta o número da conversa aberta (header do WhatsApp Web) ----
  function detectPhone() {
    // Tenta pelo título do header (leads não salvos aparecem como número).
    const candidates = [
      "#main header span[title]",
      '#main header [role="button"] span[dir="auto"]',
      "#main header span[dir='auto']",
    ];
    for (const sel of candidates) {
      const el = $(sel);
      const txt = (el?.getAttribute("title") || el?.textContent || "").trim();
      const digits = txt.replace(/\D/g, "");
      // número BR internacional tem 12-13 dígitos; aceita 10+ pra não perder edge cases
      if (digits.length >= 10 && digits.length <= 15) return digits;
    }
    return "";
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
        <label class="zpx-lbl">Número do lead</label>
        <input id="zpx-phone" class="zpx-input" placeholder="55 47 9xxxx-xxxx" />
        <div id="zpx-flows" class="zpx-flows"><div class="zpx-muted">Carregando fluxos…</div></div>
        <div id="zpx-status" class="zpx-status"></div>
      </div>
    </div>`;
  document.body.appendChild(panel);

  const card = $("#zpx-card", panel);
  const phoneInput = $("#zpx-phone", panel);
  const flowsBox = $("#zpx-flows", panel);
  const statusBox = $("#zpx-status", panel);

  const setStatus = (msg, kind) => { statusBox.textContent = msg || ""; statusBox.className = "zpx-status" + (kind ? " " + kind : ""); };

  $("#zpx-fab", panel).addEventListener("click", () => {
    const open = card.style.display !== "none";
    card.style.display = open ? "none" : "block";
    if (!open) { phoneInput.value = detectPhone(); loadFlows(); }
  });
  $("#zpx-close", panel).addEventListener("click", () => { card.style.display = "none"; });

  // Atualiza o número automaticamente ao trocar de conversa (se o card estiver aberto).
  let lastPhone = "";
  const obs = new MutationObserver(() => {
    if (card.style.display === "none") return;
    const p = detectPhone();
    if (p && p !== lastPhone && document.activeElement !== phoneInput) { lastPhone = p; phoneInput.value = p; }
  });
  const main = document.querySelector("#main") || document.body;
  obs.observe(main, { subtree: true, childList: true, characterData: true });

  function loadFlows() {
    flowsBox.innerHTML = `<div class="zpx-muted">Carregando fluxos…</div>`;
    chrome.runtime.sendMessage({ type: "flows" }, (resp) => {
      if (!resp || resp.error) { flowsBox.innerHTML = `<div class="zpx-err">${(resp && resp.error) || "Erro"}</div>`; return; }
      const flows = resp.flows || [];
      if (!flows.length) { flowsBox.innerHTML = `<div class="zpx-muted">Nenhum fluxo.</div>`; return; }
      flowsBox.innerHTML = "";
      for (const f of flows) {
        const b = document.createElement("button");
        b.className = "zpx-flow";
        b.textContent = "▶ " + f.name;
        b.addEventListener("click", () => fire(f, b));
        flowsBox.appendChild(b);
      }
    });
  }

  function fire(flow, btn) {
    const leadPhone = (phoneInput.value || "").replace(/\D/g, "");
    if (leadPhone.length < 10) { setStatus("Confira o número do lead.", "err"); return; }
    btn.disabled = true;
    setStatus("Disparando “" + flow.name + "”…");
    chrome.runtime.sendMessage({ type: "trigger", leadPhone, flowId: flow.id }, (resp) => {
      btn.disabled = false;
      if (!resp || resp.error) { setStatus((resp && resp.error) || "Erro ao disparar", "err"); return; }
      setStatus(resp.message || "Disparado!", "ok");
    });
  }
})();
