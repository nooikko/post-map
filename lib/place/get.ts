import type { Metadata } from 'next';

import { PROJECT_NAME } from '@/lib/attribution';
import { findMarkerBySlug, loadMarkers, type Marker } from '@/lib/markers/load';
import { loadArticle } from '@/lib/wiki/load';
import type { PlaceArticle } from '@/lib/wiki/types';

export interface Place {
    marker: Marker;
    article: PlaceArticle | null;
}

/** Shared loader for both the standalone place route and its intercepted modal. */
export async function getPlace(slug: string): Promise<Place | null> {
    const marker = await findMarkerBySlug(slug);
    if (!marker) return null;
    return { marker, article: await loadArticle(marker.name) };
}

export async function placeParams(): Promise<Array<{ slug: string }>> {
    const markers = await loadMarkers();
    return markers.map((m) => ({ slug: m.slug }));
}

/**
 * Metadata for a place route.
 *
 * noindex is deliberate: this site is a better map, not a mirror of the
 * Forgotten Realms Wiki, and duplicating its article text in search results is
 * exactly what the wiki community objected to in 2017. Paired with the
 * Disallow in app/robots.ts.
 */
export async function placeMetadata(slug: string): Promise<Metadata> {
    const place = await getPlace(slug);
    const name = place?.marker.name ?? 'Unknown place';

    return {
        title: `${name} · ${PROJECT_NAME}`,
        robots: { index: false, follow: false },
    };
}
