// User preferences. Persisted to localStorage. Other modules subscribe to
// changes via a simple event emitter rather than re-reading on every use.

const KEY = 'post-map:prefs:v1';
const DEFAULTS = {};

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
        return { ...DEFAULTS };
    }
}

let state = load();
const listeners = new Set();

export function get() {
    return { ...state };
}

export function set(patch) {
    state = { ...state, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full disk etc */ }
    listeners.forEach((fn) => fn(get()));
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function formatDistance(meters) {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}
