// Service Worker registration with a `?nosw` escape hatch for development.
// Exposes start/progress hooks for the "Download for offline" button.

const NOSW = new URLSearchParams(location.search).has('nosw');

let registration = null;

export async function registerSW() {
    if (NOSW) {
        console.log('[sw] skipped: ?nosw flag set');
        return null;
    }
    if (!('serviceWorker' in navigator)) {
        console.log('[sw] not supported');
        return null;
    }
    try {
        registration = await navigator.serviceWorker.register('./sw.js');
        console.log('[sw] registered:', registration.scope);
        return registration;
    } catch (err) {
        console.warn('[sw] registration failed:', err);
        return null;
    }
}

export async function unregisterSW() {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
}

/**
 * Tell the active SW to download every tile in the background.
 * onProgress receives { done, failed, total } periodically.
 * Resolves when the SW reports completion.
 */
export function precacheAllTiles(onProgress) {
    return new Promise((resolve, reject) => {
        const ctrl = navigator.serviceWorker?.controller;
        if (!ctrl) {
            reject(new Error('Service Worker not active yet — reload first'));
            return;
        }
        const handler = (event) => {
            if (event.data?.type === 'precache-progress' && onProgress) {
                onProgress(event.data);
            } else if (event.data?.type === 'precache-done') {
                navigator.serviceWorker.removeEventListener('message', handler);
                resolve(event.data);
            }
        };
        navigator.serviceWorker.addEventListener('message', handler);
        ctrl.postMessage({ type: 'precache-tiles' });
    });
}
