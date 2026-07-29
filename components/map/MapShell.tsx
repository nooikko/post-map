'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ol/ol.css is imported from app/globals.css, not here — see the note there.
// Importing it from this component puts it after globals in the cascade, which
// reverts our zoom control styling.

import { Credits } from '@/components/chrome/Credits';
import { GithubCorner } from '@/components/chrome/GithubCorner';
import { LayerToggles } from '@/components/chrome/LayerToggles';
import { MeasureControl } from '@/components/chrome/MeasureControl';
import { PlaceSearch } from '@/components/chrome/PlaceSearch';
import { Topbar } from '@/components/chrome/Topbar';
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
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const router = useRouter();

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
    // settled or the canvas keeps the old size.
    const toggleSidebar = useCallback(() => {
        setSidebarOpen((open) => !open);
        window.setTimeout(() => {
            core?.map.updateSize();
            core?.applyFitConstraints();
        }, 220);
    }, [core]);

    return (
        <MapContext.Provider value={core}>
            <div className={`${styles.shell} ${sidebarOpen ? '' : styles.collapsed}`}>
                <Topbar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
                <aside className={styles.sidebar} aria-hidden={!sidebarOpen}>
                    <PlaceSearch markers={markers} onSelect={openPlace} />
                    <MeasureControl />
                    <LayerToggles />
                    <Credits />
                </aside>
                <GithubCorner className={styles.corner} reachable={sidebarOpen} />
                <div ref={containerRef} className={styles.map} />
                <MeasureToggle onToggle={measure.toggle} />
                <MeasureReadout onClear={measure.clear} />
            </div>
        </MapContext.Provider>
    );
}
