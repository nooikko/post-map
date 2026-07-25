'use client';

import { useSyncExternalStore } from 'react';

// A deliberately tiny external store rather than a state library.
//
// The measure tool's "is active" flag is read from inside long-lived OpenLayers
// event handlers (see useMarkerInteractions). Those handlers are registered
// once per map instance, so reading React state through a closure would capture
// a stale value. An external store gives them a getState() that is always
// current, while components still subscribe reactively.

export interface MeasureState {
    active: boolean;
    /** Formatted running total, e.g. "1,240 miles". Null when not measuring. */
    readout: string | null;
}

const initial: MeasureState = { active: false, readout: null };

let state: MeasureState = initial;
const listeners = new Set<() => void>();

function emit(): void {
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getState(): MeasureState {
    return state;
}

function setState(patch: Partial<MeasureState>): void {
    const next = { ...state, ...patch };
    if (next.active === state.active && next.readout === state.readout) return;
    state = next;
    emit();
}

export function useMeasureStore(): MeasureState {
    return useSyncExternalStore(subscribe, getState, () => initial);
}

useMeasureStore.getState = getState;
useMeasureStore.setState = setState;
useMeasureStore.subscribe = subscribe;
