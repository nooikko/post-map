'use client';

import { useEffect, useState } from 'react';

import { COARSE_POINTER_QUERY } from '@/lib/pointer';

/**
 * React-side view of `(pointer: coarse)`.
 *
 * Starts `false` and only flips after mount, which is deliberate: the map page
 * is prerendered, so returning the real answer during render would mean the
 * server (where there is no `window`) and the client disagreed and hydration
 * would fail. Starting false costs nothing visually, because the CSS in
 * MapShell.module.css already hides the desktop sidebar under the same media
 * query — so a phone's first paint is a full-bleed map either way, and there is
 * no flash of the 280px panel before this settles.
 *
 * The listener is here rather than a one-shot read because a pointer type can
 * genuinely change under you: a tablet with a keyboard folio attached, or a
 * desktop browser's device emulation being toggled.
 */
export function useCoarsePointer(): boolean {
    const [coarse, setCoarse] = useState(false);

    useEffect(() => {
        if (!window.matchMedia) return;
        const query = window.matchMedia(COARSE_POINTER_QUERY);
        const sync = () => setCoarse(query.matches);
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    return coarse;
}
