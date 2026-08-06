// Service Worker mínimo para PWA/TWA da D'Griffe.
// Estratégia:
//  - / e assets estáticos (ícones, manifest): cache-first (app funciona offline)
//  - /api/* (proxy → Render): SEMPRE network (dados dinâmicos, nunca cachear)
//  - push: mostra notificação nativa (web push) e abre o app ao clicar
const CACHE = "dgriffe-v1";
const STATIC = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/maskable-192.png", "/maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Nunca cachear a API (proxy dinâmico para o backend).
  if (url.pathname.startsWith("/api/")) {
    return; // deixa passar direto pela rede
  }

  // Assets estáticos: cache-first com atualização em background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ---------------------------------------------------------------------------
// WEB PUSH — notificações nativas (cupons/promoções enviadas pelo admin)
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let dados = { title: "D'Griffe", body: "", tipo: "geral", url: "/" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      dados = { ...dados, ...parsed };
    }
  } catch {
    dados.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(dados.title || "D'Griffe", {
      body: dados.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: dados.url || "/" },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) { client.navigate(url); return client.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  event.notification.close();
});
