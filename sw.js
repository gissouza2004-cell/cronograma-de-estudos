/* Prumo – service worker (funcionamento offline)
   Coloque este arquivo na MESMA pasta do index.html. */
const VERSAO = "prumo-v1";
const CACHE_APP = VERSAO + "-app";
const CACHE_EXTRA = VERSAO + "-extra"; // fontes e outros recursos externos

const ARQUIVOS = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then((cache) =>
      Promise.all(
        ARQUIVOS.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((c) => c !== CACHE_APP && c !== CACHE_EXTRA)
            .map((c) => caches.delete(c))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Página: tenta a rede (para pegar atualizações) e cai para o cache se estiver offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_APP).then((c) => c.put("./index.html", copia));
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then((r) => r || caches.match("./index.html"))
            .then((r) => r || caches.match("./"))
        )
    );
    return;
  }

  // Demais recursos (fontes do Google, etc.): cache primeiro, atualiza em segundo plano
  event.respondWith(
    caches.match(req).then((emCache) => {
      const daRede = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copia = res.clone();
            const destino = url.origin === self.location.origin ? CACHE_APP : CACHE_EXTRA;
            caches.open(destino).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => emCache);
      return emCache || daRede;
    })
  );
});
