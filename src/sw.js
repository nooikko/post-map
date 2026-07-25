/**
 * Post Map Service Worker (injectManifest source for vite-plugin-pwa)
 *
 * - The app SHELL (hashed JS/CSS chunks + index.html) is precached by Workbox
 *   via the manifest Vite injects into `self.__WB_MANIFEST` at build time —
 *   no hand-maintained file list, so it never goes stale against hashed names.
 * - Runtime cache-first for tiles (immutable) — survives deploys (stable cache
 *   name), so a version bump never re-downloads the 8MB pyramid.
 * - Stale-while-revalidate for data JSON (GeoJSON + the local wiki mirror under
 *   data/Faerun/wiki/) so updates appear after one refresh, never an error.
 * - Exposes a `precache-tiles` message: the page can ask the SW to download
 *   every tile in the background for true offline mode.
 *
 * To bypass during development: load with ?nosw (the SW is disabled in dev).
 */
import { precacheAndRoute } from 'workbox-precaching';

import { TILE_BOUNDS } from './config.js';

// Precache + serve the hashed build output (shell). Workbox registers its own
// fetch/install handlers for these; our handlers below only own tiles + data.
precacheAndRoute(self.__WB_MANIFEST);

// Stable, unversioned names — tile bytes are immutable and data uses SWR, so
// there's no reason to drop either cache on a new SW version.
const TILE_CACHE = 'post-map-tiles';
const DATA_CACHE = 'post-map-data';
const KEEP = new Set([TILE_CACHE, DATA_CACHE]);

self.addEventListener('install', (event) => {
    // No bulk tile warm on install — the full @2x pyramid is ~30MB and normal
    // browsing caches tiles as they're viewed (cacheFirst below). Full offline
    // is opt-in via the "download all tiles" button (precache-tiles message).
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    // Drop our own pre-Vite caches (post-map-*-v6, vendor, shell);
                    // leave Workbox's workbox-precache-* caches alone.
                    .filter((k) => k.startsWith('post-map-') && !KEEP.has(k))
                    .map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // Shell (hashed assets, index.html) is handled by Workbox's precache route.
    if (url.pathname.includes('/tiles/')) {
        event.respondWith(cacheFirst(req, TILE_CACHE));
    } else if (url.pathname.includes('/data/')) {
        event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    }
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'precache-tiles') {
        event.waitUntil(precacheAllTiles(event.source));
    }
});

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone()).catch(() => {});
        return res;
    } catch (err) {
        // Offline + uncached. Return a transparent 504.
        return new Response('', { status: 504, statusText: 'Offline' });
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const networkFetch = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone()).catch(() => {});
        return res;
    }).catch(() => null);
    return cached || (await networkFetch) || new Response('', { status: 504 });
}

async function precacheAllTiles(client) {
    const cache = await caches.open(TILE_CACHE);
    const urls = [];
    for (const b of TILE_BOUNDS) {
        for (let x = 0; x <= b.maxX; x++) {
            for (let y = 0; y <= b.maxY; y++) {
                urls.push(`./tiles/${b.z}/${x}/${y}.webp`);
            }
        }
    }

    let done = 0, failed = 0;
    const BATCH = 8;
    for (let i = 0; i < urls.length; i += BATCH) {
        const slice = urls.slice(i, i + BATCH);
        await Promise.all(slice.map(async (u) => {
            try {
                if (await cache.match(u)) { done++; return; }
                const res = await fetch(u);
                if (res.ok) {
                    await cache.put(u, res);
                    done++;
                } else {
                    failed++;
                }
            } catch {
                failed++;
            }
        }));
        if (client?.postMessage) {
            client.postMessage({
                type: 'precache-progress',
                done, failed, total: urls.length,
            });
        }
    }
    if (client?.postMessage) {
        client.postMessage({ type: 'precache-done', done, failed, total: urls.length });
    }
}
