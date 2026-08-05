// Renders the site mark into every icon format a browser, a search engine or a
// phone home screen asks for:
//
//   app/icon.svg               the crisp tab icon modern browsers prefer
//   app/icon.png               32x32 — Google Search ignores SVG favicons
//   app/favicon.ico            16/32/48 — for clients that request /favicon.ico
//                              blind, without ever reading the <link> tags
//   app/apple-icon.png         180x180 — iOS "Add to Home Screen"
//   public/icon-192.png        the web manifest's small icon
//   public/icon-512.png        the web manifest's large icon
//   public/icon-maskable.png   512x512, purpose "maskable" (see MARK below)
//
// The three under app/ are Next's metadata file convention: their presence is
// what emits <link rel="icon">, <link rel="apple-touch-icon"> and the rest, so
// none of them are referenced from layout.tsx. The two under public/ are named
// by app/manifest.ts, which needs stable URLs rather than hashed ones.
//
// This script is the single source of the mark — app/icon.svg is an *output*,
// not the input. Editing it by hand is undone by the next run. Change MARK.
//
// Committed like the map images, and for the same reason (see
// gen-map-images.mjs): the mark changes about never, and recomputing seven
// byte-identical files on every build buys nothing.
//
//   pnpm icons

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Matches --codex-bg and --gold in app/globals.css. */
const BG = '#14130f';
const GOLD = '#c9a24b';

/**
 * The mark, drawn in a 32-unit box: a compass star inside a faint ring.
 *
 * Its extremities are the four star points, 11.5 units from the centre. That is
 * inside the 12.8-unit radius a maskable icon has to stay within (a circle 80%
 * of the icon's width), which is why the maskable output below needs no inset —
 * only the corner radius taken off so the background reaches every edge.
 */
const BOX = 32;

function mark({ radius }) {
    return [
        `<rect width="${BOX}" height="${BOX}"${radius ? ` rx="${radius}"` : ''} fill="${BG}"/>`,
        `<circle cx="16" cy="16" r="10.5" fill="none" stroke="${GOLD}" stroke-width="1.3" opacity="0.55"/>`,
        `<path d="M16 4.5 L18.6 13.4 L27.5 16 L18.6 18.6 L16 27.5 L13.4 18.6 L4.5 16 L13.4 13.4 Z"`,
        `      fill="${GOLD}"/>`,
        `<circle cx="16" cy="16" r="2.1" fill="${BG}"/>`,
    ].join('\n  ');
}

/**
 * @param size   pixel size to render at, or null for a resolution-independent
 *               file (the .svg output, which wants a viewBox and no width)
 * @param radius corner radius in box units; 0 renders square to the edges
 */
function svg({ size = null, radius = 6 } = {}) {
    const dims = size === null ? '' : ` width="${size}" height="${size}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="0 0 ${BOX} ${BOX}">\n  ${mark({ radius })}\n</svg>\n`;
}

/**
 * Render to PNG. `flatten` drops the alpha channel: every output here is opaque
 * anyway, and an alpha channel on an apple-touch-icon is what iOS composites
 * against black instead of the background it was given.
 *
 * `rgba` opts out of the palette for the .ico entries. The mark is five flat
 * colours, so a palette is much the smaller encoding — but Next reads
 * app/favicon.ico at build time to fill in the sizes on its <link> tag, and its
 * ICO decoder only accepts RGBA sub-images. A paletted one fails the build with
 * "The PNG is not in RGBA format!".
 */
async function png({ size, radius, rgba = false }) {
    const pipeline = sharp(Buffer.from(svg({ size, radius }))).flatten({ background: BG });
    return (rgba ? pipeline.ensureAlpha() : pipeline)
        .png({ compressionLevel: 9, palette: !rgba })
        .toBuffer();
}

/**
 * Pack PNG buffers into an .ico container.
 *
 * The format is a 6-byte header, one 16-byte directory entry per image, then
 * the image data. Entries may hold a PNG verbatim rather than the original
 * BMP-ish bitmap, which is what this does — every browser has understood
 * PNG-in-ICO for well over a decade, and it saves hand-rolling a DIB encoder.
 *
 * A dimension byte of 0 means 256; nothing here is that large, but the encoding
 * is why the field is a single byte and worth not tripping over later.
 */
function ico(images) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // 1 = icon (2 would be a cursor)
    header.writeUInt16LE(images.length, 4);

    const directory = Buffer.alloc(16 * images.length);
    let offset = header.length + directory.length;

    images.forEach(({ size, data }, i) => {
        const at = i * 16;
        directory.writeUInt8(size % 256, at + 0); // width
        directory.writeUInt8(size % 256, at + 1); // height
        directory.writeUInt8(0, at + 2); // palette size, 0 = not paletted
        directory.writeUInt8(0, at + 3); // reserved
        directory.writeUInt16LE(1, at + 4); // colour planes
        directory.writeUInt16LE(32, at + 6); // bits per pixel
        directory.writeUInt32LE(data.length, at + 8);
        directory.writeUInt32LE(offset, at + 12);
        offset += data.length;
    });

    return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

const OUTPUTS = [
    { file: 'app/icon.svg', build: async () => Buffer.from(svg()) },
    { file: 'app/icon.png', build: () => png({ size: 32, radius: 6 }) },
    // iOS rounds the corners itself, and rounds them its own way. A radius
    // baked in here would sit inside that mask as a visible dark border.
    { file: 'app/apple-icon.png', build: () => png({ size: 180, radius: 0 }) },
    { file: 'public/icon-192.png', build: () => png({ size: 192, radius: 24 }) },
    { file: 'public/icon-512.png', build: () => png({ size: 512, radius: 64 }) },
    { file: 'public/icon-maskable.png', build: () => png({ size: 512, radius: 0 }) },
    {
        file: 'app/favicon.ico',
        // 16 is what a tab actually shows; 32 and 48 are what Windows shortcuts
        // and a few crawlers pick up. Beyond 48 the .ico is dead weight — a
        // client that can render a large icon can read the <link> tags and take
        // the SVG.
        build: async () =>
            ico(
                await Promise.all(
                    [16, 32, 48].map(async (size) => ({
                        size,
                        data: await png({ size, radius: 3, rgba: true }),
                    })),
                ),
            ),
    },
];

for (const { file, build } of OUTPUTS) {
    const data = await build();
    await writeFile(path.join(ROOT, file), data);
    process.stdout.write(`${file}  ${(data.length / 1024).toFixed(1)} kB\n`);
}
