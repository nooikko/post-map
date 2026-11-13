// What a place page says about where a place is: its nearest neighbours, how
// far, and which way. Derived entirely from the marker data and the map's
// scale, so it is the one part of a place page that is this site's own rather
// than the wiki's.

import type { LayerKey } from '@/lib/map/config';
import { METERS_PER_MILE, meters, pixelToCoord } from '@/lib/map/geometry';
import type { Marker } from '@/lib/markers/load';

const NEARBY_COUNT = 6;

const BEARINGS = [
    'north',
    'north-east',
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
] as const;

export type Bearing = (typeof BEARINGS)[number];

export interface NearbyPlace {
    slug: string;
    name: string;
    category: LayerKey;
    meters: number;
    /** Which way this place lies from the one whose page it is listed on. */
    bearing: Bearing;
}

type Point = Pick<Marker, 'x' | 'y'>;

/**
 * Eight-point compass direction from `from` to `to`. The map is drawn north-up
 * and marker coordinates are image pixels, whose y grows downward — so north
 * is a *smaller* y.
 */
export function bearing(from: Point, to: Point): Bearing {
    const east = to.x - from.x;
    const north = from.y - to.y;
    const degrees = (Math.atan2(east, north) * 180) / Math.PI;
    return BEARINGS[Math.round((degrees + 360) / 45) % BEARINGS.length];
}

/** The direction back: if B is north-east of A, A is south-west of B. */
export function reverse(direction: Bearing): Bearing {
    return BEARINGS[(BEARINGS.indexOf(direction) + BEARINGS.length / 2) % BEARINGS.length];
}

/**
 * The places closest to `origin`, nearest first.
 *
 * A pin that shares the origin's name is skipped: the data has a few places
 * marked twice ("The Twin Towers", "Laviguer"), and listing a place as its own
 * neighbour says nothing.
 */
export function nearestPlaces(
    origin: Marker,
    markers: readonly Marker[],
    count: number = NEARBY_COUNT,
): NearbyPlace[] {
    const here = pixelToCoord(origin.x, origin.y);

    return markers
        .filter((m) => m.slug !== origin.slug && m.name !== origin.name)
        .map((m) => ({
            slug: m.slug,
            name: m.name,
            category: m.category,
            meters: meters(here, pixelToCoord(m.x, m.y)),
            bearing: bearing(origin, m),
        }))
        .sort((a, b) => a.meters - b.meters)
        .slice(0, count);
}

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const tenths = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

function amount(value: number): string {
    return (value < 10 ? tenths : whole).format(value);
}

/**
 * "34 miles (55 km)". Both units, because these are rendered on the server,
 * where the reader's miles-or-kilometres preference (lib/settings/units.ts)
 * lives in a browser it cannot see.
 */
export function formatMilesAndKm(distance: number): string {
    const miles = distance / METERS_PER_MILE;
    return `${amount(miles)} ${miles === 1 ? 'mile' : 'miles'} (${amount(distance / 1000)} km)`;
}
