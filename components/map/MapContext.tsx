'use client';

import { createContext, useContext } from 'react';

import type { MapCore } from '@/lib/map/create';

/**
 * The live OpenLayers map, or null until the effect in MapShell has built it.
 *
 * This replaces the Vite app's `window.__map` / `window.__layers` debug
 * handles, which were the de-facto way chrome modules reached the map.
 */
export const MapContext = createContext<MapCore | null>(null);

export function useMapCore(): MapCore | null {
    return useContext(MapContext);
}
