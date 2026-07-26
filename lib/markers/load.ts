import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { LAYERS, type LayerKey } from '@/lib/map/config';
import { resolveSlugs } from '@/lib/slug';

// Build-time only. The marker GeoJSON lives in public/ (it is also served
// directly), but pages read it off disk so the client gets markers as props
// instead of waterfalling eight fetches after hydration.

const DATA_DIR = path.join(process.cwd(), 'public', 'data', 'Faerun');

export interface Marker {
    slug: string;
    name: string;
    category: LayerKey;
    /** Image-pixel coordinates against IMG_W × IMG_H, not lon/lat. */
    x: number;
    y: number;
}

interface GeoJsonFeature {
    type: 'Feature';
    properties: { name?: string };
    geometry: { type: 'Point'; coordinates: [number, number] };
}

interface GeoJsonCollection {
    type: 'FeatureCollection';
    features: GeoJsonFeature[];
}

async function readLayer(key: LayerKey): Promise<Array<{ name: string; category: LayerKey; x: number; y: number }>> {
    const raw = await readFile(path.join(DATA_DIR, `${key}.json`), 'utf8');
    // Source files carry a UTF-8 BOM. Phase 2 removes it at the source; until
    // then JSON.parse would choke on it.
    const collection = JSON.parse(raw.replace(/^\uFEFF/, '')) as GeoJsonCollection;

    return collection.features.flatMap((feature) => {
        const name = feature.properties?.name;
        const coords = feature.geometry?.coordinates;
        if (!name || !Array.isArray(coords)) return [];
        return [{ name, category: key, x: coords[0], y: coords[1] }];
    });
}

let cached: Promise<Marker[]> | null = null;

// Slug collisions are a build-integrity check: they mean two places share a
// URL stem, and a *new* one would silently shift an existing permalink. So the
// warning belongs in `next build`, where it is read once.
//
// It is suppressed in dev. Module-scope state resets whenever Next re-evaluates
// server modules, and dev spreads requests across worker processes that don't
// share a globalThis, so there is no guard that gets this to "once" — it just
// reprints on navigation and buries the request log.
const WARNED = Symbol.for('postmap.markers.warned');

function warnOnce(message: string): void {
    if (process.env.NODE_ENV === 'development') return;
    const scope = globalThis as unknown as Record<symbol, Set<string> | undefined>;
    const seen = (scope[WARNED] ??= new Set<string>());
    if (seen.has(message)) return;
    seen.add(message);
    console.warn(message);
}

/**
 * All markers, in a deterministic order: layer render order (LAYERS), then
 * source-file order within each layer. Slug assignment depends on this order,
 * so it must not change between builds or permalinks would shift.
 */
export function loadMarkers(): Promise<Marker[]> {
    cached ??= buildMarkers();
    return cached;
}

async function buildMarkers(): Promise<Marker[]> {
    const perLayer = await Promise.all(LAYERS.map((layer) => readLayer(layer.key)));
    const flat = perLayer.flat();

    const { entries, collisions } = resolveSlugs(flat, (m) => m.name);

    if (collisions.length > 0) {
        // Not fatal: these are distinct pins that happen to share a name, and
        // both stay reachable. Surfaced so a new collision can't slip in
        // unnoticed and silently shift an existing permalink.
        const detail = collisions.map((c) => `${c.name} -> ${c.slug}`).join(', ');
        warnOnce(`[markers] ${collisions.length} slug collision(s) disambiguated: ${detail}`);
    }

    return entries.map(({ item, slug }) => ({ slug, ...item }));
}

export async function findMarkerBySlug(slug: string): Promise<Marker | undefined> {
    const markers = await loadMarkers();
    return markers.find((m) => m.slug === slug);
}
