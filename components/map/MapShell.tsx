'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ol/ol.css is imported from app/globals.css, not here — see the note there.
// Importing it from this component puts it after globals in the cascade, which
// reverts our zoom control styling.

import { BottomSheet } from '@/components/chrome/BottomSheet';
import { ChromeContents } from '@/components/chrome/ChromeContents';
import { GithubCorner } from '@/components/chrome/GithubCorner';
import { Topbar } from '@/components/chrome/Topbar';
import { useCoarsePointer } from '@/components/chrome/useCoarsePointer';
import type { MapCore } from '@/lib/map/create';
import type { Marker } from '@/lib/markers/load';

import { MapContext } from './MapContext';
import styles from './MapShell.module.css';
import { MeasureReadout } from './MeasureReadout';
import { MeasureToggle } from './MeasureToggle';
import { useMarkerInteractions } from './useMarkerInteractions';
import { useMeasureTool } from './useMeasureTool';

interface MapShellProps {
    markers: Marker[];
}

/**
 * Owns the OpenLayers lifecycle and the app chrome around it.
 *
 * OpenLayers is imported inside the effect rather than at module scope so it
 * never loads during server rendering — the Vite app built its projection and
 * tile source at import time, which does not survive SSR.
 */
export function MapShell({ markers }: MapShellProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [core, setCore] = useState<MapCore | null>(null);
    // The desktop sidebar opens with the app; the sheet has to be asked for.
    // One piece of state drives both, so `false` here would also collapse the
    // sidebar — hence the two are initialised apart, in the panel-open effect
    // below rather than here, where there is no window to ask yet.
    const [panelOpen, setPanelOpen] = useState(true);
    const coarse = useCoarsePointer();
    const router = useRouter();

    // A phone should not start with the sheet in its face. This runs once
    // useCoarsePointer has settled after mount; before then the CSS below has
    // already kept the sidebar off a touch viewport, so nothing flashes.
    useEffect(() => {
        if (coarse) setPanelOpen(false);
    }, [coarse]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let disposed = false;
        let built: MapCore | null = null;

        void (async () => {
            const { createMapCore } = await import('@/lib/map/create');
            if (disposed) return;
            built = createMapCore(el, markers);
            setCore(built);
        })();

        return () => {
            disposed = true;
            built?.dispose();
            setCore(null);
        };
    }, [markers]);

    // Keep the canvas sized to its container.
    useEffect(() => {
        if (!core) return;
        const onResize = () => {
            core.map.updateSize();
            core.applyFitConstraints();
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [core]);

    const openPlace = useCallback(
        (slug: string) => {
            // Intercepted by app/@modal/(.)place/[slug], so the map underneath
            // is never unmounted.
            router.push(`/place/${slug}`);
        },
        [router],
    );

    useMarkerInteractions(core, openPlace);

    // Instantiated once, here: the hook owns OpenLayers interactions, a vector
    // source and overlays, so calling it from both the toggle and the readout
    // would attach the tool to the map twice.
    const measure = useMeasureTool(core);

    // The sidebar animates its width; OL needs a nudge once the transition has
    // settled or the canvas keeps the old size. The sheet floats over a
    // full-bleed map instead, so on touch there is no resize to chase.
    const togglePanel = useCallback(() => {
        setPanelOpen((open) => !open);
        if (coarse) return;
        window.setTimeout(() => {
            core?.map.updateSize();
            core?.applyFitConstraints();
        }, 220);
    }, [core, coarse]);

    const closePanel = useCallback(() => setPanelOpen(false), []);

    // Picking a result flies the map to it, which there is no point watching
    // from behind a sheet.
    const selectPlace = useCallback(
        (slug: string) => {
            if (coarse) setPanelOpen(false);
            openPlace(slug);
        },
        [coarse, openPlace],
    );

    return (
        <MapContext.Provider value={core}>
            <div className={`${styles.shell} ${panelOpen ? '' : styles.collapsed}`}>
                <Topbar
                    onTogglePanel={togglePanel}
                    panelOpen={panelOpen}
                    panelLabel={coarse ? 'map controls' : 'sidebar'}
                />
                {coarse ? (
                    <BottomSheet open={panelOpen} onClose={closePanel} label="Map controls">
                        <ChromeContents markers={markers} onSelect={selectPlace} />
                    </BottomSheet>
                ) : (
                    <>
                        <aside className={styles.sidebar} aria-hidden={!panelOpen}>
                            <ChromeContents markers={markers} onSelect={selectPlace} />
                        </aside>
                        <GithubCorner className={styles.corner} reachable={panelOpen} />
                    </>
                )}
                <div ref={containerRef} className={styles.map} />
                <MeasureToggle onToggle={measure.toggle} />
                <MeasureReadout onClear={measure.clear} />
            </div>
        </MapContext.Provider>
    );
}
