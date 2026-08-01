'use client';

import type { Marker } from '@/lib/markers/load';

import { Credits } from './Credits';
import { LayerToggles } from './LayerToggles';
import { MeasureControl } from './MeasureControl';
import { PlaceSearch } from './PlaceSearch';

interface ChromeContentsProps {
    markers: Marker[];
    onSelect: (slug: string) => void;
}

/**
 * Search, units, layers and credits — the controls themselves, with no opinion
 * about what holds them. The desktop sidebar and the touch bottom sheet each
 * render exactly one of these.
 *
 * A fragment rather than a wrapping element on purpose. Both containers space
 * their children with `> * + *`, so introducing a wrapper here would collapse
 * that to a single child and flatten the rhythm — in the sidebar's case
 * changing a layout this work is meant to leave alone.
 */
export function ChromeContents({ markers, onSelect }: ChromeContentsProps) {
    return (
        <>
            <PlaceSearch markers={markers} onSelect={onSelect} />
            <MeasureControl />
            <LayerToggles />
            <Credits />
        </>
    );
}
