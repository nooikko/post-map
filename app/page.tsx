import type { Metadata } from 'next';

import { MapShell } from '@/components/map/MapShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { loadMarkers } from '@/lib/markers/load';
import { homeGraph } from '@/lib/seo/jsonLd';
import { HOME_TITLE, openGraphFor, SITE_DESCRIPTION } from '@/lib/seo/site';

/**
 * Canonical is declared here rather than inherited, and it resolves to an
 * absolute URL against `metadataBase`. It is the whole defence against this
 * page being indexed under several addresses at once — a preview deployment's
 * hostname, a `?utm_source=` link someone shares, a trailing-slash variant.
 * All of those are the map; only one of them should be in the index.
 */
export const metadata: Metadata = {
    // `absolute` because the map's title is already a complete statement of
    // what the page is, and the site-wide "· Post Map" suffix would push it
    // past where Google truncates without adding anything a searcher wants.
    title: { absolute: HOME_TITLE },
    description: SITE_DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: openGraphFor('/', HOME_TITLE, SITE_DESCRIPTION),
};

/**
 * The map. Markers are read from disk at build time and handed to the client
 * as props, so there is no post-hydration waterfall of eight GeoJSON fetches.
 *
 * That same read is what feeds the marker count to both the visible copy and
 * the structured data below. "297 places" is a claim this page makes to a
 * reader and to a crawler at once, and neither copy of it should be able to go
 * stale against the data it describes.
 */
export default async function MapPage() {
    const markers = await loadMarkers();

    return (
        <>
            <JsonLd data={homeGraph(markers.length)} />
            <MapShell markers={markers} />
        </>
    );
}
