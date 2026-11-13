// Daymark service worker: makes the app open without internet.
// Change VERSION when you want every device to drop its old cache.
const VERSION = "daymark-v2";
const SHELL = "/";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Save the page itself, then find and save its hashed JS/CSS files.
      const res = await fetch(SHELL, { cache: "reload" });
      const html = await res.clone().text();
      await cache.put(SHELL, res);
      const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|svg|webmanifest))"/g)].map((m) => m[1]);
      await Promise.all(
        [...new Set([...assets, "/manifest.webmanifest", "/favicon.svg"])].map((u) =>
          cache.add(u).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 4000)),
    ]);
    if (fresh && fresh.ok) cache.put(SHELL, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(SHELL)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await update) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never touch the sync server: it must always use the real network.
  if (url.hostname.endsWith("onrender.com")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
