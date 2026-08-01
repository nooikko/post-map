'use client';

import { createContext, useContext } from 'react';

import type { MapCore } from '@/lib/map/create';

/**
 * The live OpenLayers map, or null until the effect in MapShell has built it.
 * This is how chrome components reach the map — not a global handle.
 */
export const MapContext = createContext<MapCore | null>(null);

export function useMapCore(): MapCore | null {
    return useContext(MapContext);
}
