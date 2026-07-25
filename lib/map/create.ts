// OpenLayers construction. Everything here is deliberately behind functions
// rather than module-scope singletons: the Vite app built the projection, tile
// grid, and source at import time (src/map-core.js:22-47), which would run
// during SSR. Nothing in this module executes until createMapCore is called
// from an effect.

import Feature from 'ol/Feature.js';
import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import Point from 'ol/geom/Point.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import Projection from 'ol/proj/Projection.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';

import {
    IMG_H,
    IMG_W,
    LAYERS,
    MAX_ZOOM,
    MIN_ZOOM,
    NATIVE_ZOOM,
    TILE_URL,
    type LayerDef,
    type LayerKey,
} from './config';
import { clampCenter, fitZoomFor, pixelToCoord, type Coord } from './geometry';
import type { Marker } from '@/lib/markers/load';

const TILE_SIZE = 256;
const EXTENT: [number, number, number, number] = [0, 0, IMG_W, IMG_H];

// resolutions[z] = projection units per pixel at zoom z. At NATIVE_ZOOM the
// coordinate space is 1:1 with image pixels.
function makeResolutions(): number[] {
    return Array.from({ length: MAX_ZOOM + 1 }, (_, z) => 2 ** (NATIVE_ZOOM - z));
}

export interface MarkerLayer {
    def: LayerDef;
    layer: VectorLayer<VectorSource>;
    source: VectorSource;
    count: number;
}

export interface MapCore {
    map: OLMap;
    layers: Record<LayerKey, MarkerLayer>;
    /** Re-derive minZoom for the current viewport, then clamp. Call on resize. */
    applyFitConstraints: () => void;
    dispose: () => void;
}

export function createMapCore(target: HTMLElement, markers: readonly Marker[]): MapCore {
    const resolutions = makeResolutions();

    const projection = new Projection({
        code: 'faerun-pixels',
        units: 'pixels',
        extent: EXTENT,
    });

    // Full pyramid z0–z6: each zoom has its own dedicated tiles, so a zoomed-out
    // view loads a handful of small overview tiles instead of downscaling the
    // whole z6 set. Tiles are @2x (512px physical) over a 256px logical grid —
    // tilePixelRatio:2 tells OL the images are double-density, keeping the view
    // math in image-pixel space while rendering crisp on HiDPI screens.
    const tileGrid = new TileGrid({
        extent: EXTENT,
        origin: [0, IMG_H], // top-left of the image; XYZ convention
        resolutions,
        tileSize: TILE_SIZE, // logical size; physical is 512 via tilePixelRatio
    });

    const tileSource = new XYZ({
        projection,
        tileGrid,
        tilePixelRatio: 2,
        wrapX: false,
        cacheSize: 4096,
        tileUrlFunction: ([z, x, y]) =>
            TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)),
    });

    const tileLayer = new TileLayer({
        source: tileSource,
        preload: Infinity, // keep lower-res tiles around as fallback
        // Clip rendering to the image bounds. The low-zoom overview tiles are
        // square and larger than the (non-square) map, so they carry the
        // original art's out-of-bounds ocean fill in the margins; without this
        // clip that fill bleeds past the map edges at zoomed-out views.
        extent: EXTENT,
    });

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
        layers: [tileLayer],
        view,
        controls: defaultControls({ attributionOptions: { collapsible: false } }),
    });

    const layers = buildMarkerLayers(map, markers);

    function applyFitConstraints(): void {
        const size = map.getSize();
        if (!size || size[0] === 0 || size[1] === 0) return;
        const fitZoom = fitZoomFor(size as [number, number], NATIVE_ZOOM);
        view.setMinZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom)));
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

    return {
        map,
        layers,
        applyFitConstraints,
        dispose: () => {
            map.un('moveend', onMoveEnd);
            map.setTarget(undefined);
        },
    };
}

function buildMarkerLayers(map: OLMap, markers: readonly Marker[]): Record<LayerKey, MarkerLayer> {
    const byCategory = new Map<LayerKey, Marker[]>();
    for (const marker of markers) {
        const bucket = byCategory.get(marker.category);
        if (bucket) bucket.push(marker);
        else byCategory.set(marker.category, [marker]);
    }

    const entries = LAYERS.map((def): [LayerKey, MarkerLayer] => {
        const source = new VectorSource({ wrapX: false });
        const own = byCategory.get(def.key) ?? [];

        for (const marker of own) {
            const feature = new Feature({ geometry: new Point(pixelToCoord(marker.x, marker.y)) });
            feature.setId(marker.slug);
            feature.set('name', marker.name);
            feature.set('slug', marker.slug);
            feature.set('def', def);
            source.addFeature(feature);
        }

        const layer = new VectorLayer({
            source,
            style: makeZoomScaledStyle(def),
            // Repaint vectors while panning/zooming/animating. OL defaults both
            // to false to skip work during interactions, which makes dots vanish
            // until mouseup. We have only a few hundred points per category —
            // the per-frame cost is trivial and continuous visibility is the
            // whole point.
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            // OL only queries the source for features within viewport ±
            // renderBuffer (default 100px). At z=6 that's a tiny margin — a
            // quick pan reveals features beyond it that the renderer hasn't
            // picked up yet. For a few hundred points the RTree is cheap.
            renderBuffer: 2000,
        });
        layer.set('layerKey', def.key);
        map.addLayer(layer);

        return [def.key, { def, layer, source, count: own.length }];
    });

    return Object.fromEntries(entries) as Record<LayerKey, MarkerLayer>;
}

/**
 * Scale the circle radius up at high zoom so dots stay prominent against the
 * detailed map. Resolutions for the 7-level pyramid: z0→32 … z6→0.5. One Style
 * is cached per zoom tier so OL doesn't allocate per feature per render.
 */
function makeZoomScaledStyle(def: LayerDef): (feature: unknown, resolution: number) => Style {
    const make = (r: number) =>
        new Style({
            image: new CircleStyle({
                radius: r,
                fill: new Fill({ color: hexAlpha(def.color, 0.92) }),
                stroke: new Stroke({ color: '#000', width: 1 }),
            }),
        });

    const tiers = {
        z6: make(def.radius * 2.0),
        z5: make(def.radius * 1.6),
        z4: make(def.radius * 1.3),
        z3: make(def.radius * 1.1),
        base: make(def.radius),
    };

    return (_feature, resolution) => {
        if (resolution <= 0.5) return tiers.z6;
        if (resolution <= 1) return tiers.z5;
        if (resolution <= 2) return tiers.z4;
        if (resolution <= 4) return tiers.z3;
        return tiers.base;
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

function hexAlpha(hex: string, a: number): string {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}
