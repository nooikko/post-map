// Composes the two flat images of the map from the tile pyramid:
//
//   public/faerun-map.webp      the poster shown under the OpenLayers canvas
//   public/faerun-map-card.jpg  the 1200x630 Open Graph / Twitter card
//
// Both live in public/ rather than under app/'s opengraph-image file
// convention. The convention is tidier — it emits the tags for you and hashes
// the URL — but it emits them *in addition to* anything metadata declares, and
// lib/seo/site.ts wants one image named in one place feeding og:image and
// twitter:image alike. Two og:image tags disagreeing is worse than no hash.
//
// Both are committed, like the tiles themselves — the pyramid only changes when
// it is regenerated, and that changes the deployment (see docs/tile-pipeline.md).
// Running this at build time would spend seconds of every build recomputing a
// byte-identical file.
//
//   pnpm images
//
// Why a flat image exists at all: see components/map/MapPoster.tsx.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');

// Mirrors lib/map/config.ts. Not imported from it: this is a plain .mjs script
// and that module is TypeScript with a '@/' path alias behind it.
const IMG_W = 4763;
const IMG_H = 3185;
const NATIVE_ZOOM = 5;

/** Physical pixels per tile. The grid is logical-256 at tilePixelRatio 2. */
const TILE_PX = 512;

/**
 * Which zoom level to composite from.
 *
 * z3 lays the whole map out in 5x4 tiles and lands at 2382x1593 after the
 * margin is cropped off — comfortably above every size either output needs, so
 * both are downscales rather than upscales. z4 would be four times the pixels
 * to throw most of away.
 */
const SOURCE_ZOOM = 3;

const POSTER = {
    out: path.join(ROOT, 'public', 'faerun-map.webp'),
    // Pulling in two directions: an image search result wants the largest
    // version available, and the page wants a placeholder that is off the
    // network before the tiles it stands in for. 1400px is wide enough that
    // Google Images has a real image to rank and small enough that it is not
    // competing with the map for the first second of the connection.
    width: 1400,
    quality: 68,
};

const SOCIAL = {
    out: path.join(ROOT, 'public', 'faerun-map-card.jpg'),
    width: 1200,
    height: 630,
    // JPEG, not PNG: this is a photograph-like map under a soft gradient, which
    // is the case JPEG is for. The same card as a palette PNG was 394 kB.
    quality: 82,
};

/** Device-pixel size of the map itself at SOURCE_ZOOM, margin excluded. */
function mapSize() {
    const unitsPerLogicalPixel = 2 ** (NATIVE_ZOOM - SOURCE_ZOOM);
    const ratio = TILE_PX / 256; // tilePixelRatio
    return {
        width: Math.round((IMG_W / unitsPerLogicalPixel) * ratio),
        height: Math.round((IMG_H / unitsPerLogicalPixel) * ratio),
    };
}

/**
 * Stitch every tile at SOURCE_ZOOM into one buffer, then crop the pyramid's
 * right/bottom margin away. Tile (x, y) sits at (x * 512, y * 512): the grid
 * origin is the image's top-left, XYZ convention, per lib/map/create.ts.
 */
async function composite() {
    const { width, height } = mapSize();
    const cols = Math.ceil(width / TILE_PX);
    const rows = Math.ceil(height / TILE_PX);

    const tiles = [];
    for (let x = 0; x < cols; x += 1) {
        for (let y = 0; y < rows; y += 1) {
            tiles.push({
                input: path.join(ROOT, 'public', 'tiles', String(SOURCE_ZOOM), String(x), `${y}.webp`),
                left: x * TILE_PX,
                top: y * TILE_PX,
            });
        }
    }

    return sharp({
        create: {
            width: cols * TILE_PX,
            height: rows * TILE_PX,
            channels: 3,
            background: '#14130f',
        },
    })
        .composite(tiles)
        .extract({ left: 0, top: 0, width, height })
        .png() // lossless hand-off; each output re-encodes from here
        .toBuffer();
}

async function writePoster(flat) {
    const { width, height } = mapSize();
    const out = await sharp(flat)
        .resize({ width: POSTER.width })
        .webp({ quality: POSTER.quality, effort: 6 })
        .toBuffer();

    await writeFile(POSTER.out, out);
    return {
        file: path.relative(ROOT, POSTER.out),
        width: POSTER.width,
        height: Math.round((POSTER.width * height) / width),
        bytes: out.length,
    };
}

/**
 * The social card: the map cropped to 1.9:1 rather than letterboxed, so the
 * thumbnail is map edge to edge, with a scrim and a title along the bottom.
 *
 * Cropping loses the top and bottom of the continent and keeps the middle
 * band — the Sword Coast and the Heartlands, which is both the recognisable
 * part and where most of the markers are.
 */
async function writeSocial(flat) {
    const base = await sharp(flat)
        .resize({ width: SOCIAL.width, height: SOCIAL.height, fit: 'cover', position: 'centre' })
        .toBuffer();

    // Named families rather than a bundled font file: this runs by hand on a
    // developer's machine and the result is committed, so the render happens
    // once and is reviewed before it ships.
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL.width}" height="${SOCIAL.height}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#14130f" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#14130f" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#14130f" stop-opacity="0.94"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${SOCIAL.height - 260}" width="${SOCIAL.width}" height="260" fill="url(#scrim)"/>
  <rect x="0" y="${SOCIAL.height - 6}" width="${SOCIAL.width}" height="6" fill="#c9a24b"/>
  <text x="64" y="${SOCIAL.height - 108}" font-family="Iowan Old Style, Palatino, Georgia, serif"
        font-size="66" font-weight="600" fill="#ece3cf">Interactive Map of Faerûn</text>
  <text x="64" y="${SOCIAL.height - 56}" font-family="Iowan Old Style, Palatino, Georgia, serif"
        font-size="28" fill="#c9a24b">Pan, zoom and measure the Forgotten Realms · Post Map</text>
</svg>`);

    const out = await sharp(base)
        .composite([{ input: overlay, top: 0, left: 0 }])
        .jpeg({ quality: SOCIAL.quality, mozjpeg: true })
        .toBuffer();

    await mkdir(path.dirname(SOCIAL.out), { recursive: true });
    await writeFile(SOCIAL.out, out);
    return {
        file: path.relative(ROOT, SOCIAL.out),
        width: SOCIAL.width,
        height: SOCIAL.height,
        bytes: out.length,
    };
}

const flat = await composite();
for (const result of [await writePoster(flat), await writeSocial(flat)]) {
    const kb = (result.bytes / 1024).toFixed(0);
    process.stdout.write(`${result.file}  ${result.width}x${result.height}  ${kb} kB\n`);
}
