'use client';

import { useSyncExternalStore } from 'react';

import type { LayerKey } from '@/lib/map/config';

// Which marker categories are switched off. Shared between the layer toggles,
// which live in whichever panel is mounted (sidebar or bottom sheet), and the
// markers on the map. A store rather than component state, so it also survives
// the panel being swapped when the pointer type settles.

const NONE: ReadonlySet<LayerKey> = new Set();

let hidden: ReadonlySet<LayerKey> = NONE;
const listeners = new Set<() => void>();

export function toggleLayer(key: LayerKey): void {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    hidden = next;
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useHiddenLayers(): ReadonlySet<LayerKey> {
    return useSyncExternalStore(subscribe, () => hidden, () => NONE);
}
