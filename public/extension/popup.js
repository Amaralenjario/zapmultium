const baseUrlEl = document.getElementById("baseUrl");
const codeEl = document.getElementById("code");
const okEl = document.getElementById("ok");

chrome.storage.sync.get(["baseUrl", "code"], (cfg) => {
  baseUrlEl.value = cfg.baseUrl || "";
  codeEl.value = cfg.code || "";
});

document.getElementById("save").addEventListener("click", () => {
  const baseUrl = baseUrlEl.value.trim().replace(/\/+$/, "");
  const code = codeEl.value.trim();
  chrome.storage.sync.set({ baseUrl, code }, () => {
    okEl.textContent = "Salvo! Abra o WhatsApp Web e clique no ⚡.";
    setTimeout(() => (okEl.textContent = ""), 4000);
  });
});
