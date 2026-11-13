import Link from 'next/link';

import { layerByKey } from '@/lib/map/config';
import { formatMilesAndKm, type NearbyPlace } from '@/lib/place/nearby';

import styles from './PlacePanel.module.css';

/**
 * How a link to another place should navigate.
 *
 * - `modal`: a client-side navigation, which app/@modal/(.)place intercepts,
 *   so the neighbour opens in the same dialog over the same still-mounted map.
 * - `page`: a plain document load. On the standalone page a client-side push
 *   would be intercepted too, and open the neighbour as a dialog floating over
 *   this page rather than as a page of its own.
 */
export type PlaceLinkMode = 'modal' | 'page';

interface NearbyPlacesProps {
    places: readonly NearbyPlace[];
    linkMode: PlaceLinkMode;
    /** One below the panel's own heading. */
    headingLevel: 2 | 3;
}

/** The places around this one, with straight-line distance and direction. */
export function NearbyPlaces({ places, linkMode, headingLevel }: NearbyPlacesProps) {
    if (places.length === 0) return null;
    const Heading = headingLevel === 2 ? 'h2' : 'h3';

    return (
        <section className={styles.nearby}>
            <Heading className={styles.nearbyTitle}>Nearest places</Heading>
            <p className={styles.nearbyNote}>
                Straight-line distances on the map, as the crow flies.
            </p>
            <ul className={styles.nearbyList}>
                {places.map((place) => (
                    <li key={place.slug}>
                        <PlaceLink slug={place.slug} mode={linkMode}>
                            {place.name}
                        </PlaceLink>
                        <span className={styles.nearbyMeta}>
                            {layerByKey(place.category)?.singular ?? place.category}
                            {' · '}
                            {formatMilesAndKm(place.meters)} {place.bearing}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function PlaceLink({ slug, mode, children }: { slug: string; mode: PlaceLinkMode; children: string }) {
    const href = `/place/${slug}`;
    if (mode === 'page') return <a href={href}>{children}</a>;
    // No prefetch: each place's payload carries its whole article.
    //
    // `replace`, because the dialog closes through router.back(). Pushed, a hop
    // from one place to the next leaves the previous place under it in
    // history, and closing the dialog reopens that place instead of returning
    // to the map.
    return (
        <Link href={href} prefetch={false} replace>
            {children}
        </Link>
    );
}
