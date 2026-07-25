'use client';

import { useSyncExternalStore } from 'react';

// Distance units for the measure tool.
//
// The Vite app shipped this half-built: settings.js had an empty DEFAULTS, a
// no-op syncDialogToState, and formatDistance hardcoded to miles, behind a
// settings dialog whose only working control was the offline download. That
// download is gone, so the dialog is gone with it and the preference lives
// inline in the Tools section instead — finished rather than stubbed.

export type DistanceUnit = 'mi' | 'km';

const STORAGE_KEY = 'postmap:units:v1';
const DEFAULT_UNIT: DistanceUnit = 'mi';

const METERS_PER_MILE = 1609.344;

let unit: DistanceUnit | null = null;
const listeners = new Set<() => void>();

/** Read on first use rather than at module scope, which would throw under SSR. */
function current(): DistanceUnit {
    if (unit !== null) return unit;
    if (typeof window === 'undefined') return DEFAULT_UNIT;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        unit = stored === 'km' || stored === 'mi' ? stored : DEFAULT_UNIT;
    } catch {
        unit = DEFAULT_UNIT; // private mode, disabled storage
    }
    return unit;
}

export function getUnit(): DistanceUnit {
    return current();
}

export function setUnit(next: DistanceUnit): void {
    if (current() === next) return;
    unit = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // Preference just won't persist; not worth surfacing.
    }
    for (const listener of listeners) listener();
}

export function subscribeUnit(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useUnit(): DistanceUnit {
    return useSyncExternalStore(subscribeUnit, getUnit, () => DEFAULT_UNIT);
}

/** Format a distance in metres using the active unit. */
export function formatDistance(meters: number): string {
    if (current() === 'km') {
        const km = meters / 1000;
        return `${km.toFixed(km < 10 ? 1 : 0)} km`;
    }
    const miles = meters / METERS_PER_MILE;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}
