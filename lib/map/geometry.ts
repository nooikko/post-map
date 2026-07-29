// Pure coordinate math for the image-pixel projection. No OpenLayers import,
// so this is safe to use from server components and easy to reason about on
// its own.

import { IMG_H, IMG_W, METERS_PER_PIXEL } from './config';

export type Coord = [number, number];

/**
 * Image pixel (x, y) — with Y growing downward — to projection coordinate
 * (Y grows upward, origin at the bottom-left of the image extent).
 */
export function pixelToCoord(x: number, y: number): Coord {
    return [x, IMG_H - y];
}

/**
 * Straight-line metres between two coordinates in the pixel-projection CRS.
 * Coordinates are image pixels, scaled by METERS_PER_PIXEL.
 */
export function meters(a: Coord, b: Coord): number {
    return Math.hypot(b[0] - a[0], b[1] - a[1]) * METERS_PER_PIXEL;
}

/**
 * Clamp a candidate centre so the viewport never shows background past the
 * image edges. Per axis: if the image is smaller than the viewport, centre it
 * (the zoomed-out "floating in the middle" case); otherwise keep the viewport
 * flush inside the image so a zoomed-in pan can't drift past an edge into
 * empty space.
 *
 * `resolution` and `size` set the viewport's span in projection units — half a
 * viewport on each side of centre.
 */
export function clampCenter(center: Coord, resolution: number, size: [number, number]): Coord {
    const [vw, vh] = size;
    const halfW = (vw * resolution) / 2;
    const halfH = (vh * resolution) / 2;

    const clampAxis = (c: number, half: number, span: number): number =>
        2 * half >= span ? span / 2 : Math.min(Math.max(c, half), span - half);

    return [clampAxis(center[0], halfW, IMG_W), clampAxis(center[1], halfH, IMG_H)];
}

/**
 * Resolution at which the whole image exactly fits the viewport — the tighter
 * axis wins, so nothing is cropped.
 *
 * The map is 4763 × 3185 (1.50:1), close enough to a typical window that "fit"
 * and "fill" land within a few percent of each other; fitting is preferred
 * because it never hides part of the map.
 */
export function fitResolutionFor(size: [number, number]): number {
    const [vw, vh] = size;
    return Math.max(IMG_W / vw, IMG_H / vh);
}

/**
 * Exact (fractional) zoom at which the whole image fits the viewport.
 *
 * Deliberately not rounded. Snapping down to an integer zoom level costs up to
 * a factor of two in scale, which is what left the map floating in a sea of
 * background on first load. The view's `resolutions` array defines the tile
 * levels, not the set of zooms the view may hold — OpenLayers interpolates
 * between them, so a fractional zoom is legitimate and renders from the
 * nearest tile level.
 */
export function fitZoomFor(size: [number, number], nativeZoom: number): number {
    return nativeZoom - Math.log2(fitResolutionFor(size));
}
