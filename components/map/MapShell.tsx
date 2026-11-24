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
import { getMapVersion, useMapVersion } from '@/lib/settings/mapVersion';

import { MapContext } from './MapContext';
import { MapMarkers } from './MapMarkers';
import { MapPoster } from './MapPoster';
import styles from './MapShell.module.css';
import { MeasureReadout } from './MeasureReadout';
import { MeasureToggle } from './MeasureToggle';
import { useMeasureTool } from './useMeasureTool';

interface MapShellProps {
    markers: Marker[];
}

/**
 * Owns the OpenLayers lifecycle and the app chrome around it.
 *
 * OpenLayers is imported inside the effect rather than at module scope so it
 * never loads during server rendering, which it does not survive.
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
            // Read at build time rather than taken as a dependency: a change
            // of version swaps the tile source on the live map (below), it
            // does not rebuild the map.
            built = createMapCore(el, getMapVersion());
            setCore(built);
        })();

        return () => {
            disposed = true;
            built?.dispose();
            setCore(null);
        };
    }, []);

    // The version chosen in the map options dialog. Also runs once on build,
    // where it is a no-op: the map was created with this same value.
    const mapVersion = useMapVersion();
    useEffect(() => {
        core?.setMapVersion(mapVersion);
    }, [core, mapVersion]);

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

    // The search box's way to a place; the dots are links of their own
    // (MapMarkers). Intercepted by app/@modal/(.)place/[slug], so the map
    // underneath is never unmounted.
    const openPlace = useCallback(
        (slug: string) => {
            router.push(`/place/${slug}`);
        },
        [router],
    );

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
                        {/*
                          * inert as well as aria-hidden: collapsed, the sidebar
                          * is only slid off-screen, and its controls would
                          * otherwise stay in the tab order with nothing visible
                          * taking focus.
                          */}
                        <aside className={styles.sidebar} aria-hidden={!panelOpen} inert={!panelOpen}>
                            <ChromeContents markers={markers} onSelect={selectPlace} />
                        </aside>
                        <GithubCorner className={styles.corner} reachable={panelOpen} />
                    </>
                )}
                {/*
                  * Before the map container, not inside it: OpenLayers appends
                  * its viewport to whatever element it is handed, and a
                  * sibling image already in there would be laid out above it
                  * rather than behind. The two are stacked by the module's
                  * shared positioning instead.
                  */}
                <MapPoster />
                <div ref={containerRef} className={styles.map} />
                <MapMarkers markers={markers} core={core} className={styles.markers} />
                <MeasureToggle onToggle={measure.toggle} />
                <MeasureReadout onClear={measure.clear} />
            </div>
        </MapContext.Provider>
    );
}
