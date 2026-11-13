// OpenLayers construction. Everything here stays behind functions rather than
// module-scope singletons: building the projection, tile grid or source at
// import time would run it during SSR. Nothing in this module executes until
// createMapCore is called from an effect.

import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import Layer from 'ol/layer/Layer.js';
import TileLayer from 'ol/layer/Tile.js';
import Projection from 'ol/proj/Projection.js';
import XYZ from 'ol/source/XYZ.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js';

import {
    IMG_H,
    IMG_W,
    LAYER_Z,
    MAX_ZOOM,
    MIN_ZOOM,
    NATIVE_ZOOM,
    TILE_SETS,
    type MapVersion,
} from './config';
import { clampCenter, coverZoomFor, fitZoomFor, type Coord } from './geometry';
import { isCoarsePointer } from '@/lib/pointer';

const TILE_SIZE = 256;
const EXTENT: [number, number, number, number] = [0, 0, IMG_W, IMG_H];

/**
 * How far a pointer may travel between press and release and still count as a
 * tap rather than a drag.
 *
 * OpenLayers defaults this to 1 pixel, which is right for a mouse and wrong for
 * a finger. Past the tolerance it sets `dragging_`, and `handlePointerUp_` then
 * skips click emulation altogether — so no `click` event is dispatched at all.
 * A fingertip tap essentially always drifts more than a pixel, which is why
 * placing a measure point or opening a place by tapping its marker mostly did
 * nothing on a phone: the events were never fired, so no handler was at fault.
 *
 * 8px is comfortably outside the jitter of a tap and still well inside a
 * deliberate pan. Mice keep the stock 1px, so a small drag-pan on the desktop
 * still swallows its click exactly as before.
 */
const TAP_MOVE_TOLERANCE_PX = 8;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

// resolutions[z] = projection units per pixel at zoom z. At NATIVE_ZOOM the
// coordinate space is 1:1 with image pixels.
function makeResolutions(maxZoom: number = MAX_ZOOM): number[] {
    return Array.from({ length: maxZoom + 1 }, (_, z) => 2 ** (NATIVE_ZOOM - z));
}

/**
 * The tile source for one version of the map.
 *
 * Each zoom has its own dedicated tiles, so a zoomed-out view loads a handful
 * of small overview tiles instead of downscaling the deepest set. Tiles are
 * @2x (512px physical) over a 256px logical grid — tilePixelRatio:2 tells OL
 * the images are double-density, keeping the view math in image-pixel space
 * while rendering crisp on HiDPI screens.
 *
 * The grid stops at the set's own deepest level. The view does not: zoomed in
 * past it, OpenLayers draws that level enlarged, which is how `original` shows
 * the source picture's own pixels without a second copy of them on disk.
 */
function makeTileSource(projection: Projection, version: MapVersion): XYZ {
    const { url, maxZoom } = TILE_SETS[version];

    const tileGrid = new TileGrid({
        extent: EXTENT,
        origin: [0, IMG_H], // top-left of the image; XYZ convention
        resolutions: makeResolutions(maxZoom),
        tileSize: TILE_SIZE, // logical size; physical is 512 via tilePixelRatio
    });

    return new XYZ({
        projection,
        tileGrid,
        tilePixelRatio: 2,
        wrapX: false,
        cacheSize: 4096,
        tileUrlFunction: ([z, x, y]) =>
            url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)),
    });
}

/**
 * The tiled map. The place markers are not drawn by it: they are DOM links
 * (components/map/MapMarkers.tsx), so that they exist in the server-rendered
 * page.
 */
export interface MapCore {
    map: OLMap;
    /**
     * Where MapMarkers puts the dots once the map exists: the element of a
     * layer of its own, so the dots stack among the map's layers — over the
     * tiles, under the measure line — rather than over all of them, and sit
     * inside the viewport, so a drag or wheel that starts on a dot still
     * reaches the map.
     */
    markerHost: HTMLElement;
    /**
     * Draw a different version of the map. The view, the markers and any
     * measurement stay exactly where they are: both versions share one grid.
     */
    setMapVersion: (version: MapVersion) => void;
    /** Re-derive minZoom for the current viewport, then clamp. Call on resize. */
    applyFitConstraints: () => void;
    dispose: () => void;
}

export function createMapCore(target: HTMLElement, version: MapVersion): MapCore {
    const resolutions = makeResolutions();
    const coarse = isCoarsePointer();

    const projection = new Projection({
        code: 'faerun-pixels',
        units: 'pixels',
        extent: EXTENT,
    });

    const tileLayer = new TileLayer({
        source: makeTileSource(projection, version),
        preload: Infinity, // keep lower-res tiles around as fallback
        // Clip rendering to the image bounds. The low-zoom overview tiles are
        // square and larger than the (non-square) map, so they carry the
        // original art's out-of-bounds ocean fill in the margins; without this
        // clip that fill bleeds past the map edges at zoomed-out views.
        extent: EXTENT,
        zIndex: LAYER_Z.tiles,
    });

    // A layer with no source that renders as one fixed element. OpenLayers
    // puts whatever `render` returns into its layer stack in zIndex order and
    // leaves it alone otherwise; MapMarkers fills it and keeps it in step
    // with the view.
    const markerHost = document.createElement('div');
    markerHost.className = 'map-markers';
    const markerLayer = new Layer({ render: () => markerHost, zIndex: LAYER_Z.markers });

    const view = new View({
        projection,
        resolutions,
        center: [IMG_W / 2, IMG_H / 2],
        zoom: 2,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // Only constrain the *center* to stay inside the image. With the
        // default (full-viewport constraint), low-zoom views where the image
        // fits the screen can't pan at all, and high-zoom views get locked at
        // the bounds before they reach the corners.
        extent: EXTENT,
        constrainOnlyCenter: true,
        showFullExtent: true,
    });

    const map = new OLMap({
        target,
        layers: [tileLayer, markerLayer],
        view,
        controls: defaultControls({ attributionOptions: { collapsible: false } }),
        // See TAP_MOVE_TOLERANCE_PX. Only raised for fingers; a mouse keeps
        // OpenLayers' own default so desktop click-versus-drag is unchanged.
        moveTolerance: coarse ? TAP_MOVE_TOLERANCE_PX : 1,
        /*
         * Pinch-rotate off. It is a touch-only gesture, so this changes nothing
         * on the desktop, where alt+shift-drag still rotates.
         *
         * Two things went wrong when a pinch-zoom picked up a few degrees of
         * rotation on the way, as they always do. The rotate-reset control that
         * `defaults()` also installs has no styling anywhere in this project, so
         * it appeared as OpenLayers' unstyled white default button in the map's
         * top-right; and clampCenter() computes the viewport's half-span
         * assuming an axis-aligned viewport, so a rotated view could be panned
         * past the image edge into background.
         */
        interactions: defaultInteractions({ pinchRotate: false }),
    });

    // OpenLayers sets the viewport to `overflow: hidden`, which the browser
    // can still scroll: focusing a place dot off the edge of the view slid the
    // whole map aside and left it there. Clip is never scrollable.
    const viewport = map.getViewport();
    if (viewport) viewport.style.overflow = 'clip';

    // The viewport has no size until the container is laid out, so the first
    // successful call is also the one that sizes the initial view.
    let hasFitted = false;

    function applyFitConstraints(): void {
        const size = map.getSize();
        if (!size || size[0] === 0 || size[1] === 0) return;

        const fitZoom = fitZoomFor(size as [number, number], NATIVE_ZOOM);

        // Floor for zooming out. This MUST be a whole number: when a View is
        // built with a `resolutions` array, OpenLayers derives maxResolution by
        // indexing `resolutions[minZoom]`, and a fractional index yields
        // undefined — which collapses the resolution constraint, makes
        // view.isDef() false, and stops the map rendering at all, silently.
        //
        // Flooring the exact fit already leaves room to pull back past it. The
        // previous `- 1` on top of that allowed a further halving, which is how
        // the map ended up adrift in a field of background.
        const floorZoom = clamp(Math.floor(fitZoom), MIN_ZOOM, MAX_ZOOM);
        view.setMinZoom(floorZoom);

        if (!hasFitted) {
            hasFitted = true;
            // Touch opens filling the viewport, a mouse opens showing the whole
            // map. On a phone in portrait the two differ enormously: fitting a
            // 1.50:1 map into a 0.46:1 window spends about two thirds of the
            // screen on background and packs every marker into an untappable
            // clump. Only the opening view differs — minZoom is still derived
            // from the fit below, so pinching out to the whole of Faerûn works
            // exactly as it does on the desktop.
            const openingZoom = coarse
                ? coverZoomFor(size as [number, number], NATIVE_ZOOM)
                : fitZoom;
            // The initial zoom, unlike minZoom, may be fractional: setZoom goes
            // through getResolutionForZoom, which interpolates between tile
            // levels. So the opening view can fit the window exactly rather
            // than snapping down to a whole level and shrinking by up to half.
            view.setZoom(clamp(openingZoom, floorZoom, MAX_ZOOM));
            view.setCenter([IMG_W / 2, IMG_H / 2]);
        }

        clampView(map, view);
    }

    applyFitConstraints();

    // moveend fires after any zoom/pan settles. Defer the clamp to the next
    // frame: calling view.animate() synchronously inside moveend gets swallowed
    // by OL's animation cleanup, so the glide never starts.
    const onMoveEnd = () => {
        requestAnimationFrame(() => clampView(map, view, { animate: true }));
    };
    map.on('moveend', onMoveEnd);

    let drawn = version;

    return {
        map,
        markerHost,
        setMapVersion: (next) => {
            if (next === drawn) return;
            drawn = next;
            tileLayer.setSource(makeTileSource(projection, next));
        },
        applyFitConstraints,
        dispose: () => {
            map.un('moveend', onMoveEnd);
            map.setTarget(undefined);
        },
    };
}

function clampView(map: OLMap, view: View, { animate = false } = {}): void {
    const size = map.getSize();
    if (!size) return;
    const res = view.getResolution();
    if (!res) return;
    const center = view.getCenter();
    if (!center) return;

    const [cx, cy] = center as Coord;
    const [nx, ny] = clampCenter([cx, cy], res, size as [number, number]);
    if (nx === cx && ny === cy) return;

    if (animate) view.animate({ center: [nx, ny], duration: 250 });
    else view.setCenter([nx, ny]);
}
