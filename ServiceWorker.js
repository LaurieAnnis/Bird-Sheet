// Bird Sheet service worker.
// "Name Files As Hashes" puts a content hash in every build file name, so the cache name below
// changes whenever the build does. That byte change is what makes browsers install this worker
// again; the new copy then takes over immediately and deletes the previous build's cache.
const cachePrefix = "DefaultCompany-BirdSheet-";
const cacheName = cachePrefix + "1.1.0-47c0d617e730b6618d3f5e2e7bb40a7c.loader.js-ff13cde4e9a2509b567ea3bc71c0ccfc.framework.js-caedc6fe9dd5f948f0d78ffdcf815669.data-7ed539f980325d49259994d20069f0ea.wasm";

// Re-fetched past the HTTP cache on install (GitHub Pages lets browsers keep files for 10 minutes)
const appShell = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "TemplateData/style.css"
];

// Content-hashed, so a copy already in the HTTP cache is guaranteed current
const buildFiles = [
    "Build/47c0d617e730b6618d3f5e2e7bb40a7c.loader.js",
    "Build/ff13cde4e9a2509b567ea3bc71c0ccfc.framework.js",
    "Build/caedc6fe9dd5f948f0d78ffdcf815669.data",
    "Build/7ed539f980325d49259994d20069f0ea.wasm"
];

self.addEventListener("install", function (e) {
    e.waitUntil((async function () {
        const cache = await caches.open(cacheName);
        await cache.addAll(appShell.map(function (url) { return new Request(url, { cache: "reload" }); }));
        await cache.addAll(buildFiles);
        // Take over without waiting for every open copy of the app to close
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", function (e) {
    e.waitUntil((async function () {
        // Other games on this origin keep their own caches, so only this app's old builds are removed
        const names = await caches.keys();
        await Promise.all(names
            .filter(function (name) { return name.startsWith(cachePrefix) && name !== cacheName; })
            .map(function (name) { return caches.delete(name); }));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", function (e) {
    const request = e.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

    // The page and manifest come from the network first, so a new deploy is picked up on the next launch
    if (request.mode === "navigate" || request.url.endsWith(".webmanifest")) {
        e.respondWith(networkFirst(request));
        return;
    }

    // Everything else belongs to this build and never changes within it
    e.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
    const cache = await caches.open(cacheName);
    try {
        // "no-cache" revalidates with the server instead of trusting the 10-minute HTTP cache
        const response = await fetch(request, { cache: "no-cache" });
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (err) {
        // Offline: fall back to this build's copy
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === "navigate") return cache.match("index.html");
        throw err;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
}
