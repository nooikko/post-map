// Static configuration for the Faerûn map.
// Tied to the specific tile pyramid and source image — do not change without
// regenerating tiles and re-deriving METERS_PER_PIXEL.

export const IMG_W = 4763;
export const IMG_H = 3185;

/** Tile zoom range available on disk. */
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 6;

// Image-pixel projection anchor (matches leaflet-rastercoords math).
// At this zoom, 1 CRS unit == 1 image pixel exactly. Used for marker
// placement, distance math, and the bounds rectangle. Zoom 6 is over-zoom
// for sharpness when the user wheels in close.
export const NATIVE_ZOOM = Math.ceil(Math.log2(Math.max(IMG_W, IMG_H) / 256));

// The map's scale: real-world metres per native-resolution image pixel. The
// distance tool and the "about this map" figures both measure against it.
export const METERS_PER_PIXEL = 1287.473;

/**
 * Stacking order of the map's layers: the tiles, the place dots over them
 * (components/map/MapMarkers.tsx), and the measure line over both.
 */
export const LAYER_Z = { tiles: 0, markers: 1, measure: 2 } as const;

/**
 * The two versions of the map a reader can choose between (the choice itself
 * lives in lib/settings/mapVersion.ts, the wording in
 * components/chrome/MapOptions.tsx).
 *
 * Both are cut from the same picture on the same grid, so markers, distances
 * and the view are untouched by a switch.
 */
export type MapVersion = 'enhanced' | 'original';

export interface TileSet {
    /**
     * Root-absolute: Next resolves relative URLs against the current route, so
     * `/place/waterdeep` would otherwise look for tiles under
     * `/place/tiles/...`.
     *
     * The `v2` segment is the cache key. Tiles are served immutable for a year
     * (next.config.ts), so a regenerated pyramid has to arrive at a new
     * address or returning visitors keep the old one.
     */
    url: string;
    /**
     * Deepest level this set has tiles for. Past it the view keeps zooming to
     * MAX_ZOOM and OpenLayers enlarges this level, which for `original` is the
     * point: its deepest level is the source picture pixel for pixel, and
     * there is nothing truer to show beyond it.
     */
    maxZoom: number;
}

export const TILE_SETS: Readonly<Record<MapVersion, TileSet>> = {
    enhanced: { url: '/tiles/v2/enhanced/{z}/{x}/{y}.webp', maxZoom: MAX_ZOOM },
    original: { url: '/tiles/v2/original/{z}/{x}/{y}.webp', maxZoom: NATIVE_ZOOM - 1 },
};

export const DEFAULT_MAP_VERSION: MapVersion = 'enhanced';

export function isMapVersion(value: unknown): value is MapVersion {
    return value === 'enhanced' || value === 'original';
}

export type LayerKey =
    | 'Ports'
    | 'Cities'
    | 'PortCapitals'
    | 'Capitals'
    | 'Temples'
    | 'Sites'
    | 'Fortresses'
    | 'Ruins';

export interface LayerDef {
    key: LayerKey;
    label: string;
    /** One of them, for prose: "Waterdeep is a port capital". */
    singular: string;
    color: string;
    radius: number;
}

// Marker categories, in render order (later = on top).
// Color + radius distinguish them at a glance.
export const LAYERS: readonly LayerDef[] = [
    { key: 'Ports', label: 'Ports', singular: 'Port', color: '#50e3c2', radius: 5 },
    { key: 'Cities', label: 'Cities', singular: 'City', color: '#4a90e2', radius: 5 },
    { key: 'PortCapitals', label: 'Port Capitals', singular: 'Port capital', color: '#9013fe', radius: 6 },
    { key: 'Capitals', label: 'Capitals', singular: 'Capital', color: '#f5a623', radius: 6 },
    { key: 'Temples', label: 'Temples', singular: 'Temple', color: '#ffffff', radius: 4 },
    { key: 'Sites', label: 'Sites', singular: 'Site', color: '#f57c00', radius: 4 },
    { key: 'Fortresses', label: 'Fortresses', singular: 'Fortress', color: '#d0021b', radius: 5 },
    { key: 'Ruins', label: 'Ruins', singular: 'Ruin', color: '#8b572a', radius: 4 },
];

export function layerByKey(key: string): LayerDef | undefined {
    return LAYERS.find((l) => l.key === key);
}
