'use client';

import type { Marker } from '@/lib/markers/load';

import { AboutMap } from './AboutMap';
import { Credits } from './Credits';
import { LayerToggles } from './LayerToggles';
import { MeasureControl } from './MeasureControl';
import { PlaceSearch } from './PlaceSearch';

interface ChromeContentsProps {
    markers: Marker[];
    onSelect: (slug: string) => void;
}

/**
 * Search, units, layers, about and credits — the panel's contents, with no
 * opinion about what holds them. The desktop sidebar and the touch bottom
 * sheet each render exactly one of these.
 *
 * A fragment, not a wrapper: both containers space their children with
 * `> * + *`, which a wrapper would collapse to a single child.
 *
 * AboutMap sits below the controls because it is prose rather than a control,
 * next to the credits it shares a register with.
 */
export function ChromeContents({ markers, onSelect }: ChromeContentsProps) {
    return (
        <>
            <PlaceSearch markers={markers} onSelect={onSelect} />
            <MeasureControl />
            <LayerToggles />
            <AboutMap placeCount={markers.length} />
            <Credits />
        </>
    );
}
