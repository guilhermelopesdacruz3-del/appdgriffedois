// Service Worker mínimo para PWA/TWA da D'Griffe.
// Estratégia:
//  - / e assets estáticos (ícones, manifest): cache-first (app funciona offline)
//  - /api/* (proxy → Render): SEMPRE network (dados dinâmicos, nunca cachear)
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
