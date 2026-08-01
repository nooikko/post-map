/**
 * Whether the primary input is a coarse pointer — a finger rather than a mouse.
 *
 * This is the single switch the mobile treatment hangs off, in preference to a
 * width breakpoint. A phone held in landscape is 844px wide, which any sensible
 * width rule would hand the desktop layout; and a laptop with a touchscreen
 * reports `pointer: fine` for its *primary* input, so it correctly keeps the
 * desktop layout despite having a digitiser. Width tells you about the window,
 * `pointer` tells you about the hand.
 *
 * Guarded for server rendering: the map page is prerendered at build time, so
 * this runs in Node during the build, where `window` does not exist.
 */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function isCoarsePointer(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(COARSE_POINTER_QUERY).matches;
}
