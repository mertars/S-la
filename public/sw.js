// Routinix service worker.
//  1) Chrome'un "yüklenebilirlik" kriteri için kayıtlı SW + fetch handler (bkz. src/hooks/useInstallPrompt.js).
//  2) Harcama Takibi (/kesem) çevrimdışı AÇILABİLSİN diye YALNIZCA şunlar önbelleğe alınır:
//       • /kesem sayfa kabuğu (index.html): AĞ-ÖNCELİKLİ → çevrimiçiyken HER ZAMAN güncel; ağ yoksa önbellek.
//       • /assets/* : Vite içerik-hash'li (adı içeriğiyle değişir) → bayat içeriğe kilitleme riski YOK.
//     Routinix'in kendi sayfaları ve diğer tüm istekler eskisi gibi doğrudan ağa gider (önbellek yok).
const CACHE = "routinix-kesem-v1";
const SHELL_KEY = "/__kesem_shell__";
const MAX_ASSETS = 160;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith("routinix-kesem-") && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })()
  )
);

const isKesemNav = (req, url) => req.mode === "navigate" && (url.pathname === "/kesem" || url.pathname.startsWith("/kesem/"));

async function trim(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((r) => new URL(r.url).pathname.startsWith("/assets/"));
  for (const r of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(r);
}

async function cacheShellAssets(cache, html) {
  const urls = [...new Set([...html.matchAll(/["'(](\/assets\/[^"'()\s]+)/g)].map((m) => m[1]))];
  await Promise.all(urls.map(async (u) => { if (!(await cache.match(u))) { try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch { /* çevrimdışı */ } } }));
  await trim(cache);
}

async function kesemShell(event) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(event.request);
    if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) {
      const copy = res.clone();
      await cache.put(SHELL_KEY, copy.clone());
      event.waitUntil(copy.text().then((html) => cacheShellAssets(cache, html)));
    }
    return res;
  } catch (err) {
    const hit = await cache.match(SHELL_KEY);
    if (hit) return hit;
    throw err;
  }
}

async function hashedAsset(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.origin === self.location.origin) {
      if (isKesemNav(req, url)) return event.respondWith(kesemShell(event));
      if (url.pathname.startsWith("/assets/")) return event.respondWith(hashedAsset(req));
    }
  }
  event.respondWith(fetch(req));
});
