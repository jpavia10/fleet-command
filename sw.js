/* Fleet Command. Network first. Same-origin shell only.
   No background sync, no periodic sync, no secrets. */
var CACHE = "fleet-command-paused-v1";
var SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./fleet.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icons/favicon-32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./fonts/outfit-latin-300-normal.woff2",
  "./fonts/outfit-latin-400-normal.woff2",
  "./fonts/outfit-latin-500-normal.woff2",
  "./fonts/outfit-latin-ext-300-normal.woff2",
  "./fonts/outfit-latin-ext-400-normal.woff2",
  "./fonts/outfit-latin-ext-500-normal.woff2",
  "./data/registry.json",
  "./data/history.json",
  "./data/fleet-sebastian.json",
  "./data/fleet-claude.json",
  "./data/fleet-grok.json",
  "./data/fleet-gemini.json",
  "./data/fleet-chatgpt.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (hit) { return hit || caches.match("./index.html"); });
  }));
});
