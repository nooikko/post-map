'use client';

import { useSyncExternalStore } from 'react';

import { DEFAULT_MAP_VERSION, isMapVersion, type MapVersion } from '@/lib/map/config';

// Which version of the map artwork to draw. Chosen in the map options dialog
// (components/chrome/MapOptions.tsx) and applied by MapShell, which swaps the
// tile source on the live map.
//
// Same shape as lib/settings/units.ts: a module-level value behind
// useSyncExternalStore, persisted per device.

const STORAGE_KEY = 'postmap:map-version:v1';

let version: MapVersion | null = null;
const listeners = new Set<() => void>();

/** Read on first use rather than at module scope, which would throw under SSR. */
export function getMapVersion(): MapVersion {
    if (version !== null) return version;
    if (typeof window === 'undefined') return DEFAULT_MAP_VERSION;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        version = isMapVersion(stored) ? stored : DEFAULT_MAP_VERSION;
    } catch {
        version = DEFAULT_MAP_VERSION; // private mode, disabled storage
    }
    return version;
}

export function setMapVersion(next: MapVersion): void {
    if (getMapVersion() === next) return;
    version = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // The choice just won't outlive the tab; not worth surfacing.
    }
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useMapVersion(): MapVersion {
    return useSyncExternalStore(subscribe, getMapVersion, () => DEFAULT_MAP_VERSION);
}
