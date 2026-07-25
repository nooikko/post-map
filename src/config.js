// Static configuration for the Faerûn map.
// Tied to the specific tile pyramid and source image — do not change without
// regenerating tiles and re-deriving meterPerPixel.

export const IMG_W = 4763;
export const IMG_H = 3185;

// Tile zoom range available on disk
export const MIN_ZOOM = 0;
export const MAX_ZOOM = 6;

// Image-pixel projection anchor (matches leaflet-rastercoords math).
// At this zoom, 1 CRS unit == 1 image pixel exactly. Used for marker
// placement, distance math, and the bounds rectangle. Zoom 6 is over-zoom
// for sharpness when the user wheels in close.
export const NATIVE_ZOOM = Math.ceil(Math.log2(Math.max(IMG_W, IMG_H) / 256));

// Scale from the original map. Pocket Plane Group's Faerûn map at this
// resolution measures 1287.473 real-world meters per native-resolution
// image pixel.
export const METERS_PER_PIXEL = 1287.473;

export const TILE_URL = 'tiles/{z}/{x}/{y}.webp';

// Bounds of the tiles that exist on disk, per zoom level (full pyramid z0–z6,
// @2x 512px webp). Matches the source tile coverage; used by the service
// worker's offline "download all tiles" precache. 1296 tiles total.
export const TILE_BOUNDS = [
    { z: 0, maxX: 0,  maxY: 0  },
    { z: 1, maxX: 1,  maxY: 0  },
    { z: 2, maxX: 2,  maxY: 1  },
    { z: 3, maxX: 4,  maxY: 3  },
    { z: 4, maxX: 9,  maxY: 6  },
    { z: 5, maxX: 18, maxY: 12 },
    { z: 6, maxX: 37, maxY: 24 },
];

// Marker categories, in render order (later = on top).
// Color + radius distinguish them at a glance.
export const LAYERS = [
    { key: 'Ports',        label: 'Ports',         color: '#50e3c2', radius: 5 },
    { key: 'Cities',       label: 'Cities',        color: '#4a90e2', radius: 5 },
    { key: 'PortCapitals', label: 'Port Capitals', color: '#9013fe', radius: 6 },
    { key: 'Capitals',     label: 'Capitals',      color: '#f5a623', radius: 6 },
    { key: 'Temples',      label: 'Temples',       color: '#ffffff', radius: 4 },
    { key: 'Sites',        label: 'Sites',         color: '#f57c00', radius: 4 },
    { key: 'Fortresses',   label: 'Fortresses',    color: '#d0021b', radius: 5 },
    { key: 'Ruins',        label: 'Ruins',         color: '#8b572a', radius: 4 },
];
