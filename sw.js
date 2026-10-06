const VERSION = "v1";
const SHELL_CACHE = `wo-shell-${VERSION}`;
const SDK_CACHE = "wo-sdk-10.14.1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/constants.js",
  "./js/firebase.js",
  "./js/router.js",
  "./js/lib/availability.js",
  "./js/lib/costing.js",
  "./js/lib/money.js",
  "./js/lib/pdf.js",
  "./js/lib/pdfkit.js",
  "./js/lib/proposal.js",
  "./js/lib/receipt.js",
  "./js/pwa.js",
  "./js/services/assets.js",
  "./js/services/availability.js",
  "./js/services/blocks.js",
  "./js/services/bookings.js",
  "./js/services/costs.js",
  "./js/services/packages.js",
  "./js/services/payments.js",
  "./js/services/vendors.js",
  "./js/views/login.js",
  "./js/views/register.js",
  "./js/views/status.js",
  "./js/views/vendor.js",
  "./js/views/vendor/blockForm.js",
  "./js/views/vendor/calendar.js",
  "./js/views/vendor/dayPanel.js",
  "./js/views/vendor/paymentForm.js",
  "./js/views/vendor/profileform.js",
  "./js/views/owner.js",
  "./js/views/owner/approvals.js",
  "./js/views/owner/checker.js",
  "./js/views/owner/costs.js",
  "./js/views/owner/overview.js",
  "./js/views/owner/package.js",
  "./js/views/owner/packageBuilder.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== SDK_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request) || await cache.match("./index.html");
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || refresh.then((response) => response || Response.error());
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      request.mode === "navigate" ? networkFirst(request) : staleWhileRevalidate(request)
    );
    return;
  }

  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    event.respondWith(cacheFirst(request, SDK_CACHE));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});