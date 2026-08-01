'use client';

import { useEffect } from 'react';

import type { MapCore } from '@/lib/map/create';
import { isCoarsePointer } from '@/lib/pointer';

import { useMeasureStore } from './measureStore';

/**
 * How near a press has to land to count as hitting a marker. The dots render at
 * 4–6px base radius, so a mouse needs very little help; a fingertip covers
 * something closer to 10mm and gets a target it can actually hit.
 */
const HIT_TOLERANCE_MOUSE = 4;
const HIT_TOLERANCE_TOUCH = 12;

/**
 * Marker click → place route, plus the hover tooltip and pointer cursor.
 *
 * Cursor and tooltip share a single pointermove handler and one hit-test, as
 * in the Vite app — running forEachFeatureAtPixel twice per frame was the
 * thing that made panning feel heavy.
 */
export function useMarkerInteractions(core: MapCore | null, onOpen: (slug: string) => void): void {
    useEffect(() => {
        if (!core) return;
        const { map } = core;
        const coarse = isCoarsePointer();
        const hitTolerance = coarse ? HIT_TOLERANCE_TOUCH : HIT_TOLERANCE_MOUSE;

        const onClick = (evt: import('ol/MapBrowserEvent.js').default) => {
            if (useMeasureStore.getState().active) return;
            const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { hitTolerance });
            const slug = feature?.get('slug');
            if (typeof slug === 'string') onOpen(slug);
        };

        map.on('click', onClick);

        /*
         * Everything below is hover, which a finger does not do. Touch devices
         * still emit pointermove — one event on the way through a tap — so
         * leaving this attached does not merely waste a hit-test: it puts a
         * tooltip on screen at the tapped point and nothing ever moves away to
         * take it down again. Tapping the marker opens the place anyway, which
         * is the name and rather more.
         */
        if (coarse) {
            return () => {
                map.un('click', onClick);
            };
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'ol-marker-tooltip';
        tooltip.hidden = true;
        document.body.appendChild(tooltip);

        let overlay: import('ol/Overlay.js').default | null = null;
        let disposed = false;

        const onPointerMove = (evt: import('ol/MapBrowserEvent.js').default) => {
            const target = map.getTargetElement();
            if (useMeasureStore.getState().active || evt.dragging) {
                if (target) target.style.cursor = '';
                tooltip.hidden = true;
                return;
            }

            const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { hitTolerance });
            const name = feature?.get('name');

            if (feature && typeof name === 'string') {
                if (target) target.style.cursor = 'pointer';
                tooltip.textContent = name;
                tooltip.hidden = false;
                const geometry = feature.getGeometry();
                if (geometry && 'getCoordinates' in geometry) {
                    overlay?.setPosition(
                        (geometry as import('ol/geom/Point.js').default).getCoordinates(),
                    );
                }
            } else {
                if (target) target.style.cursor = '';
                tooltip.hidden = true;
            }
        };

        void (async () => {
            const { default: Overlay } = await import('ol/Overlay.js');
            if (disposed) return;
            overlay = new Overlay({
                element: tooltip,
                positioning: 'bottom-center',
                offset: [0, -8],
                stopEvent: false,
            });
            map.addOverlay(overlay);
        })();

        map.on('pointermove', onPointerMove);

        return () => {
            disposed = true;
            map.un('click', onClick);
            map.un('pointermove', onPointerMove);
            if (overlay) map.removeOverlay(overlay);
            tooltip.remove();
        };
    }, [core, onOpen]);
}
