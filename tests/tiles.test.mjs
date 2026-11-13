import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { IMG_H, IMG_W, NATIVE_ZOOM, TILE_SETS } from '../lib/map/config.ts';

const PUBLIC = path.resolve(import.meta.dirname, '..', 'public');

/** Tile columns and rows a level needs to cover the image, at 256 logical px. */
function grid(z) {
    const scale = 2 ** (NATIVE_ZOOM - z);
    return [Math.ceil(IMG_W / scale / 256), Math.ceil(IMG_H / scale / 256)];
}

const file = (url, z, x, y) =>
    path.join(PUBLIC, url.replace('{z}', z).replace('{x}', x).replace('{y}', y));

for (const [name, set] of Object.entries(TILE_SETS)) {
    test(`the ${name} tile set has every tile its levels promise`, () => {
        for (let z = 0; z <= set.maxZoom; z += 1) {
            const [cols, rows] = grid(z);
            for (let x = 0; x < cols; x += 1) {
                for (let y = 0; y < rows; y += 1) {
                    assert.ok(existsSync(file(set.url, z, x, y)), `${name} ${z}/${x}/${y}`);
                }
            }
        }
    });

    test(`the ${name} tile set stops at its declared deepest level`, () => {
        assert.equal(existsSync(file(set.url, set.maxZoom + 1, 0, 0)), false);
    });
}
