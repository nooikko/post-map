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

/** Projection coordinate → image pixel. */
export function coordToPixel(coord: Coord): { x: number; y: number } {
    return { x: coord[0], y: IMG_H - coord[1] };
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
 * Zoom level at which the whole image just fits the viewport, minus one level
 * of breathing room. The view is built with a fixed `resolutions` array, so
 * this must be an integer index into it.
 */
export function fitZoomFor(size: [number, number], nativeZoom: number): number {
    const [vw, vh] = size;
    const fitRes = Math.max(IMG_W / vw, IMG_H / vh);
    return Math.floor(nativeZoom - Math.log2(fitRes)) - 1;
}
