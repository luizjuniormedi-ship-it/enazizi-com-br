// Kill-switch service worker.
// Substitui qualquer SW antigo (vite-plugin-pwa) que estava interceptando
// requisições no preview do Lovable e causando HTTP 412 por headers
// condicionais inválidos. Este SW limpa caches, força reload e se desregistra.
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      await self.clients.claim();
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await Promise.all(
        clients.map((c) => {
          const url = new URL(c.url);
          url.searchParams.set("sw-cleanup", Date.now().toString());
          return c.navigate(url.toString()).catch(() => {});
        })
      );
      await self.registration.unregister();
    })()
  )
);
// Pass-through: nunca interceptar fetch. Deixa tudo ir direto à rede.
self.addEventListener("fetch", () => {});
