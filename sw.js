/* Mes Fiches de Révision : mode hors ligne.
   - La page se charge toujours depuis internet d'abord (donc toujours à jour), et une copie sert de secours hors connexion.
   - Firebase et les scripts externes ne sont jamais touchés : ils passent directement par le navigateur.
   Pour forcer une purge chez tout le monde un jour, change simplement le numéro de CACHE. */
const CACHE = "mesrevisions-v1";
const PAGE = "./index.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.add(PAGE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, key, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match(key).then((r) => r || Response.error());
    const timer = setTimeout(() => { if (!done) { done = true; fallback().then(resolve); } }, timeoutMs);
    fetch(req, { cache: "no-cache" }).then((res) => {   // no-cache : le navigateur revérifie toujours auprès du serveur
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      if (!done) { done = true; clearTimeout(timer); fallback().then(resolve); }
    });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Firebase, CDN… : on ne touche à rien
  if (url.pathname.endsWith("/sw.js")) return;
  if (req.mode === "navigate") { e.respondWith(networkFirst(req, PAGE, 4000)); return; }
  e.respondWith(networkFirst(req, req, 4000));               // icônes et autres fichiers du site
});
