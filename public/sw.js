// Service worker mínimo — habilita a instalação do app (PWA).
// Não faz cache agressivo: só existe pra o navegador oferecer "Instalar".
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first simples; se offline, tenta o cache (vazio por padrão) e por fim segue o navegador.
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((r) => r || Response.error()))
  );
});
