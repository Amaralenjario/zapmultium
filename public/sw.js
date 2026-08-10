// Service worker — habilita a instalação do app (PWA) e as notificações (Web Push).
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

// ── Notificações (Web Push) ──
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "ZapMultium";
  const options = {
    body: data.body || "Nova mensagem",
    icon: "/icons/192",
    badge: "/icons/192",
    tag: data.tag || undefined,      // agrupa por conversa
    renotify: true,                  // vibra/soa de novo mesmo agrupando
    data: { url: data.url || "/dashboard/chat-ao-vivo" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard/chat-ao-vivo";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Se já tem uma aba do painel aberta, navega ela pra conversa e foca.
      for (const client of list) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          if ("navigate" in client) { client.navigate(url).catch(() => {}); }
          return client.focus();
        }
      }
      // Senão, abre uma nova.
      return self.clients.openWindow(url);
    })
  );
});
