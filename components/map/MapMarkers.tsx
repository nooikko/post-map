'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

import { IMG_H, IMG_W, LAYERS } from '@/lib/map/config';
import type { MapCore } from '@/lib/map/create';
import type { Marker } from '@/lib/markers/load';

import { useHiddenLayers } from './layerVisibility';
import styles from './MapMarkers.module.css';
import { useMeasureStore } from './measureStore';

interface MapMarkersProps {
    markers: readonly Marker[];
    core: MapCore | null;
    /** Positions the pre-map box in the map's place (MapShell.module.css). */
    className: string;
}

/** What the pointer press behind a click did before the click arrived. */
interface Press {
    /** It became a pan of the map. */
    dragged: boolean;
    /** It began while measuring — even if the click itself finished the measurement. */
    measuring: boolean;
}

const UNPRESSED: Press = { dragged: false, measuring: false };

/**
 * Dots grow as the map zooms in so they stay prominent against the detailed
 * art. Resolution is image pixels per screen pixel: z6 is 0.5, z0 is 32.
 * MapMarkers.module.css repeats these steps for the view the map opens on.
 */
function dotScale(resolution: number): number {
    if (resolution <= 0.5) return 2;
    if (resolution <= 1) return 1.6;
    if (resolution <= 2) return 1.3;
    if (resolution <= 4) return 1.1;
    return 1;
}

function percent(value: number, of: number): string {
    return `${((value / of) * 100).toFixed(4)}%`;
}

/**
 * Every place on the map, as a dot that is a link to its page.
 *
 * The dots are DOM, not canvas, so they are in the HTML the server sends —
 * a link with the place's name, sitting where the place is — and they work
 * before any script has run. Until OpenLayers is built they are laid over the
 * poster in the same box, fitted (or, on touch, covering) exactly as the map
 * opens, so the handover does not move them.
 *
 * Once the map exists they are portalled into a layer of its own (MapCore's
 * markerHost), above the tiles and below the measure line. One element — the
 * frame — is moved per rendered frame to track the view; the dots inside it
 * are placed by percentage and never touched.
 */
export function MapMarkers({ markers, core, className }: MapMarkersProps) {
    const frameRef = useRef<HTMLElement>(null);
    const press = useRef<Press>(UNPRESSED);
    const hidden = useHiddenLayers();

    const groups = useMemo(
        () => LAYERS.map((def) => ({ def, places: markers.filter((m) => m.category === def.key) })),
        [markers],
    );

    // A layout effect, and a synchronous first render below, so the frame is
    // placed before the browser paints the dots in their new home.
    useLayoutEffect(() => {
        const frame = frameRef.current;
        if (!core || !frame) return;
        const { map } = core;
        const view = map.getView();

        const sync = () => {
            const resolution = view.getResolution();
            const origin = map.getPixelFromCoordinate([0, IMG_H]);
            if (!resolution || !origin) return;
            const scale = 1 / resolution;
            frame.style.width = `${IMG_W * scale}px`;
            frame.style.height = `${IMG_H * scale}px`;
            // Rotation as well, because alt+shift-drag still rotates the view on
            // a desktop. OpenLayers' rotation is clockwise, as CSS's is.
            frame.style.transform =
                `translate(${origin[0]}px, ${origin[1]}px) rotate(${view.getRotation()}rad)`;
            frame.style.setProperty('--dot-scale', String(dotScale(resolution)));
        };

        // A press that turns into a drag pans the map; it must not also open
        // the place it started on. OpenLayers only reports a drag once the
        // pointer passes its moveTolerance, so a tap that drifts a little is
        // still a tap — the same rule it applies to its own clicks.
        //
        // Measuring is read here too, at the press, not at the click: the
        // measure tool hears OpenLayers' click, which comes on pointerup, and
        // a click that finishes a measurement switches measuring off before
        // the browser's own click reaches the link.
        const viewport = map.getViewport();
        if (!viewport) return;
        const onDown = () => {
            press.current = { dragged: false, measuring: useMeasureStore.getState().active };
        };
        const onDrag = () => {
            press.current = { ...press.current, dragged: true };
            frame.dataset.dragging = '';
        };
        const onUp = () => {
            delete frame.dataset.dragging;
        };

        map.on('postrender', sync);
        map.on('pointerdrag', onDrag);
        viewport.addEventListener('pointerdown', onDown, true);
        window.addEventListener('pointerup', onUp);
        // The map has usually not drawn a frame yet, and until it has there is
        // no view to place the frame by.
        map.renderSync();
        sync();

        return () => {
            map.un('postrender', sync);
            map.un('pointerdrag', onDrag);
            viewport.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('pointerup', onUp);
        };
    }, [core]);

    const onClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
        // No press behind it: the keyboard or assistive technology activated
        // the link, which is a request for the place whatever the map is doing.
        if (event.detail === 0) return;
        const { dragged, measuring } = press.current;
        // While measuring, a click on a dot places a point (the measure tool
        // hears it through the viewport) rather than opening the place.
        if (dragged || measuring || useMeasureStore.getState().active) event.preventDefault();
    }, []);

    const frame = (
        <nav
            ref={frameRef}
            aria-label="Places on the map"
            className={`${styles.frame} ${core ? '' : styles.opening}`}
            style={{ '--map-w': IMG_W, '--map-h': IMG_H } as CSSProperties}
        >
            {groups.map(({ def, places }) => (
                <div
                    key={def.key}
                    className={styles.layer}
                    hidden={hidden.has(def.key)}
                    style={{ '--dot-color': def.color, '--dot-r': def.radius } as CSSProperties}
                >
                    {places.map((place) => (
                        <Link
                            key={place.slug}
                            href={`/place/${place.slug}`}
                            // Each place's payload carries its whole article.
                            prefetch={false}
                            // Reachable by search and by screen readers' link
                            // lists; 297 tab stops before the zoom buttons
                            // would be no help to anyone.
                            tabIndex={-1}
                            // A link is draggable by default, and the browser's
                            // own link drag would swallow a pan that starts on
                            // a dot.
                            draggable={false}
                            className={styles.dot}
                            style={{ left: percent(place.x, IMG_W), top: percent(place.y, IMG_H) }}
                            onClick={onClick}
                        >
                            <span className={styles.label}>{place.name}</span>
                        </Link>
                    ))}
                </div>
            ))}
        </nav>
    );

    if (core) return createPortal(frame, core.markerHost);

    // Before the map exists: in the map's own box, above the poster.
    return <div className={`${className} ${styles.box}`}>{frame}</div>;
}
