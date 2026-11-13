import type { Metadata } from 'next';

import { PROJECT_NAME } from '@/lib/attribution';
import { layerByKey } from '@/lib/map/config';
import { loadMarkers, type Marker } from '@/lib/markers/load';
import { openGraphFor } from '@/lib/seo/site';
import { loadArticle } from '@/lib/wiki/load';
import type { PlaceArticle } from '@/lib/wiki/types';

import { formatMilesAndKm, nearestPlaces, reverse, type NearbyPlace } from './nearby';

export interface Place {
    marker: Marker;
    article: PlaceArticle | null;
    nearby: NearbyPlace[];
}

/** Shared loader for both the standalone place route and its intercepted modal. */
export async function getPlace(slug: string): Promise<Place | null> {
    const markers = await loadMarkers();
    const marker = markers.find((m) => m.slug === slug);
    if (!marker) return null;
    return {
        marker,
        article: await loadArticle(marker.name),
        nearby: nearestPlaces(marker, markers),
    };
}

export async function placeParams(): Promise<Array<{ slug: string }>> {
    const markers = await loadMarkers();
    return markers.map((m) => ({ slug: m.slug }));
}

/** "Waterdeep is a port capital on the interactive map of Faerûn, 21 miles (34 km) north of …" */
function placeDescription(marker: Marker, nearby: readonly NearbyPlace[]): string {
    const kind = (layerByKey(marker.category)?.singular ?? 'place').toLowerCase();
    const article = /^[aeiou]/.test(kind) ? 'an' : 'a';
    const closest = nearby[0];
    const where = closest
        ? `, ${formatMilesAndKm(closest.meters)} ${reverse(closest.bearing)} of ${closest.name}`
        : '';
    return (
        `${marker.name} is ${article} ${kind} on the interactive map of Faerûn${where}. `
        + 'Distances to the places around it, and its Forgotten Realms Wiki entry.'
    );
}

/**
 * Metadata for a place route.
 *
 * noindex is deliberate: this site is a better map, not a mirror of the
 * Forgotten Realms Wiki, and duplicating its article text in search results is
 * exactly what the wiki community objected to in 2017. Paired with the
 * Disallow in app/robots.ts.
 *
 * The description and Open Graph block are for a shared link's preview, not
 * for search. They are built from the map data, never from the article.
 */
export async function placeMetadata(slug: string): Promise<Metadata> {
    const place = await getPlace(slug);
    if (!place) return { title: 'Unknown place', robots: { index: false, follow: false } };

    const { marker, nearby } = place;
    const path = `/place/${marker.slug}`;
    // The distinctive half only: app/layout.tsx's title template appends
    // "· Post Map".
    const title = `${marker.name} on the map of Faerûn`;
    const description = placeDescription(marker, nearby);

    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: openGraphFor(path, `${title} · ${PROJECT_NAME}`, description),
        robots: { index: false, follow: false },
    };
}
