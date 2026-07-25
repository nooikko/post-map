'use client';

import { useEffect } from 'react';

import type { MapCore } from '@/lib/map/create';

import { useMeasureStore } from './measureStore';

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

        const tooltip = document.createElement('div');
        tooltip.className = 'ol-marker-tooltip';
        tooltip.hidden = true;
        document.body.appendChild(tooltip);

        let overlay: import('ol/Overlay.js').default | null = null;
        let disposed = false;

        const onClick = (evt: import('ol/MapBrowserEvent.js').default) => {
            if (useMeasureStore.getState().active) return;
            const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { hitTolerance: 4 });
            const slug = feature?.get('slug');
            if (typeof slug === 'string') onOpen(slug);
        };

        const onPointerMove = (evt: import('ol/MapBrowserEvent.js').default) => {
            const target = map.getTargetElement();
            if (useMeasureStore.getState().active || evt.dragging) {
                if (target) target.style.cursor = '';
                tooltip.hidden = true;
                return;
            }

            const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { hitTolerance: 4 });
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

        map.on('click', onClick);
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
