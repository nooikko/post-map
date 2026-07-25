import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';
import Projection from 'ol/proj/Projection.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';

import {
    IMG_W, IMG_H, MIN_ZOOM, MAX_ZOOM, NATIVE_ZOOM, METERS_PER_PIXEL,
} from './config.js';

const TILE_SIZE = 256;

// resolutions[z] = projection units per pixel at zoom z. At NATIVE_ZOOM (5)
// the coordinate space is 1:1 with image pixels.
const resolutions = Array.from(
    { length: MAX_ZOOM + 1 },
    (_, z) => Math.pow(2, NATIVE_ZOOM - z),
);

export const projection = new Projection({
    code: 'faerun-pixels',
    units: 'pixels',
    extent: [0, 0, IMG_W, IMG_H],
});

// Full pyramid z0–z6: each zoom has its own dedicated tiles, so a zoomed-out
// view loads a handful of small overview tiles instead of downscaling the
// whole z6 set. Tiles are @2x (512px physical) over a 256px logical grid —
// tilePixelRatio:2 tells OL the images are double-density, keeping the view
// math in image-pixel space while rendering crisp on HiDPI screens.
const tileGrid = new TileGrid({
    extent: [0, 0, IMG_W, IMG_H],
    origin: [0, IMG_H],          // top-left of the image; XYZ convention
    resolutions,                 // one entry per zoom level (z0..z6)
    tileSize: TILE_SIZE,         // logical size; physical is 512 via tilePixelRatio
});

const tileSource = new XYZ({
    projection,
    tileGrid,
    tilePixelRatio: 2,           // 512px @2x images on the 256px logical grid
    wrapX: false,
    cacheSize: 4096,
    tileUrlFunction: ([z, x, y]) => `tiles/${z}/${x}/${y}.webp`,
});

/**
 * Create the OL map, attach the tile layer, fit to image bounds.
 * Returns { map, projection, extent }.
 */
export function createMap(containerId) {
    const tileLayer = new TileLayer({
        source: tileSource,
        preload: Infinity,       // keep lower-res tiles around as fallback
        // Clip rendering to the image bounds. The low-zoom overview tiles are
        // square and larger than the (non-square) map, so they carry the
        // original art's out-of-bounds ocean fill in the margins; without this
        // clip that fill bleeds past the map edges at zoomed-out views.
        extent: [0, 0, IMG_W, IMG_H],
    });

    const view = new View({
        projection,
        resolutions,
        center: [IMG_W / 2, IMG_H / 2],
        zoom: 2,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // Only constrain the *center* to stay inside the image. With the
        // default (full-viewport constraint), low-zoom views where the
        // image fits the screen can't pan at all, and high-zoom views
        // get locked at the bounds before they reach the corners.
        extent: [0, 0, IMG_W, IMG_H],
        constrainOnlyCenter: true,
        showFullExtent: true,
    });

    const map = new Map({
        target: containerId,
        layers: [tileLayer],
        view,
        controls: defaultControls({
            attributionOptions: { collapsible: false },
        }),
    });

    applyFitConstraints(map, view);
    window.addEventListener('resize', () => {
        map.updateSize();
        applyFitConstraints(map, view);
    });
    // moveend fires after any zoom/pan settles. Defer the clamp to the
    // next frame: calling view.animate() synchronously inside moveend gets
    // swallowed by OL's animation cleanup, so the glide never starts.
    map.on('moveend', () => {
        requestAnimationFrame(() => clampView(map, view, { animate: true }));
    });

    return { map, projection, extent: [0, 0, IMG_W, IMG_H] };
}

// Cap how far the user can zoom out so the image always at least fills the
// viewport on its smaller axis. Recomputed on resize because the fit-zoom
// depends on viewport size.
function applyFitConstraints(map, view) {
    const size = map.getSize();
    if (!size) return;
    const [vw, vh] = size;
    if (vw === 0 || vh === 0) return;
    // Resolution at which the image just covers the viewport (whichever
    // axis is tighter wins — we want no whitespace on either side).
    // Resolution at which the whole image just fits inside the viewport
    // (whichever axis is looser wins — we want the entire map visible).
    const fitRes = Math.max(IMG_W / vw, IMG_H / vh);
    // The view was built with a fixed `resolutions` array, so minZoom must
    // be an integer index into it. Floor gives the level where the map
    // just fits; drop one more for breathing room so the user can pull
    // back slightly past a perfect fit.
    const fitZoom = Math.floor(NATIVE_ZOOM - Math.log2(fitRes)) - 1;
    view.setMinZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom)));
    clampView(map, view);
}

/**
 * Clamp a candidate center so the viewport never shows background past the
 * image edges. Per axis: if the image is smaller than the viewport, center
 * it (zoomed-out "floating in the middle" case); otherwise keep the
 * viewport flush inside the image so a zoomed-in pan can't drift past an
 * edge into empty space. `resolution` and `size` set the viewport's span in
 * projection units (half a viewport on each side of center).
 */
export function clampCenter(center, resolution, size) {
    const [vw, vh] = size;
    const halfW = (vw * resolution) / 2;
    const halfH = (vh * resolution) / 2;
    const clampAxis = (c, half, span) =>
        2 * half >= span ? span / 2 : Math.min(Math.max(c, half), span - half);
    return [
        clampAxis(center[0], halfW, IMG_W),
        clampAxis(center[1], halfH, IMG_H),
    ];
}

// Apply clampCenter to the live view. Without it, constrainOnlyCenter lets a
// zoomed-out image drift into a corner with whitespace on the other side, and
// lets a zoomed-in pan run past an edge. `animate: true` glides the view;
// otherwise it snaps (used during initial layout/resize).
function clampView(map, view, { animate = false } = {}) {
    const size = map.getSize();
    if (!size) return;
    const res = view.getResolution();
    if (!res) return;
    const [cx, cy] = view.getCenter();
    const [nx, ny] = clampCenter([cx, cy], res, size);
    if (nx === cx && ny === cy) return;
    if (animate) {
        view.animate({ center: [nx, ny], duration: 250 });
    } else {
        view.setCenter([nx, ny]);
    }
}

/**
 * Image pixel (x, y) — with Y growing downward — to OL projection
 * coordinate (Y grows upward, origin bottom-left of the image extent).
 */
export function pixelToCoord(x, y) {
    return [x, IMG_H - y];
}

/**
 * OL projection coordinate → image pixel { x, y }.
 */
export function coordToPixel(coord) {
    return { x: coord[0], y: IMG_H - coord[1] };
}

/**
 * Straight-line meters between two OL coordinates in our pixel-projection
 * CRS. Coordinates are in image pixels, scale by METERS_PER_PIXEL.
 */
export function meters(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]) * METERS_PER_PIXEL;
}
