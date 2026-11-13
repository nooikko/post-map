# How the map tiles were made

The tiles in `public/tiles/v2/` are the artifact of record. The scripts that
produced them were one-time tools (Python with NumPy, SciPy, OpenCV and Pillow)
and are not part of this repository. This file records what they did, with the
parameters, so the same result can be produced again or the method reused on
another map.

## What is served

Two sets, cut from one picture on one grid: 512×512 WebP over a 256px logical
grid, `xyz` scheme, origin at the image's top-left. `lib/map/config.ts` reads
both (`TILE_SETS`).

| Set | Levels | Tiles | Size | What it is |
|---|---|---|---|---|
| `enhanced` | z0–z6 | 1/2/6/20/70/247/950 | 22.7 MB | Decoded, cleaned, enlarged ×4, ink firmed up |
| `original` | z0–z4 | 1/2/6/20/70 | 6.8 MB | Decoded, nothing else |

z4 is the picture pixel for pixel. z5 and z6 hold no more detail than z4; they
are the same pixels at ×2 and ×4, so everything about them is a question of how
the enlargement is done. `original` has no z5 or z6: past z4 the viewer
enlarges z4 itself.

## Source

`FRposterLarge_150.jpg`, the Faerûn poster map as published by Wizards of the
Coast: 4763 × 3185, 6,198,908 bytes, baseline JPEG with colour at full
resolution (4:4:4). An archived copy is at
`web.archive.org/web/20161101073403/http://archive.wizards.com/dnd/images/wd_maps/FRposterLarge_150.jpg`.

Small lettering in it is about six pixels tall. That is the ceiling on what any
of the steps below can show.

## Step 1 — Decode the JPEG under its own limits

A JPEG stores each 8×8 block as frequency coefficients rounded to a step size.
A standard decoder takes each rounded value as the answer, which is what puts
seams between blocks and ripples beside sharp edges. The rounded value only
says which interval the true coefficient was in. This step looks for the
smoothest image whose coefficients all stay inside their intervals
(projection onto the quantisation constraint set, with a total-variation flow
as the smoother).

### The file was compressed twice

The file's own step sizes are 1–3, close to lossless. Its coefficients cluster
on a much coarser grid, which is the mark of an earlier save. The intervals
that matter are that earlier save's, so its step sizes were recovered from the
file:

- For each frequency, a candidate step `q` is scored by how closely the stored
  values sit on multiples of `q`, measured on values at least 2.5 steps out so
  that a step that is off by one shows. Two independent estimates (a likelihood
  fit of the histogram, and the mean of `cos(2πv/q)`) were required to agree.
- The brightness table came out symmetric in all 27 mirrored pairs that could
  be measured from both sides.

Brightness (the constant term, top-left, was read from its histogram, which
peaks every 6):

```
 6  4  7 11 14 17 22 17
 4  5  6 10 14 19 12 12
 7  6  8 14 19 12 12 12
11 10 14 19 12 12 12 12
14 14 19 12 12 12 12 12
17 19 12 12 12 12 12 12
22 12 12 12 12 12 12 12
17 12 12 12 12 12 12 12
```

Colour (both colour channels). Only the coarse and middle entries could be
measured; the rest are filled with 12, the value the measured part levels off
at. The constant term could not be settled and keeps the file's own narrow
interval:

```
 -  9 19 34 20 12 12 12
 9 12 19 14 12 12 12 12
19 19 14 14 12 12 12 12
34 14 14 12 12 12 12 12
20 12 12 12 12 12 12 12
12 12 12 12 12 12 12 12
12 12 12 12 12 12 12 12
12 12 12 12 12 12 12 12
```

### The decode

Per channel (Y, Cb, Cr), with `q2` the file's step and `q1` the recovered one:

1. Stored value `v = round(DCT(block) / q2) · q2`, orthonormal 8×8 DCT of the
   level-shifted block.
2. Interval. With `m = round(v / q1)`: if `|v − m·q1| ≤ q2/2 + 1` the value
   sits on the original grid and the interval is `m·q1 ± q1/2`. Otherwise it is
   `v ± (q2/2 + 0.5)`. About 97% of values sit on the grid.
3. 120 passes of: one total-variation flow step
   (`x += τ·ε·div(∇x / √(|∇x|² + ε²))`, `τ = 0.4`, `ε = 2`, forward
   differences), then DCT every block, clip every coefficient to its interval,
   inverse DCT.
4. Convert to RGB.

The result is still 4763 × 3185. Measured against a standard decode: the extra
brightness step at block borders falls from 30% above the rest to 1.3%, no
pixel moves by more than 40 levels of 255, and edge steepness is unchanged to
within 2%.

`original` is this image and nothing more.

## Step 2 — The enhanced set

Run over the whole decoded image, never tile by tile, in strips that overlap by
16 source pixels so every filter sees real neighbours. Processing tiles
separately is what produces seams.

In order, with `f` the decoded image as floats:

1. **Light cleaning at source size.** Two bilateral passes (diameter 7, colour
   sigma 8 then 5.5, spatial sigma 2), kept off the ink. Ink is measured per
   pixel: `light` is the luminance after a 5×5 morphological close and a
   Gaussian (sigma 1.5); `ink = clip((light − luminance − 14) / 20, 0, 1)`,
   softened with a Gaussian (sigma 0.5). Output is
   `smoothed·(1 − ink) + f·ink`. Cleaning before enlarging matters: enlarged
   specks are harder to remove and get sharpened into blocks.
2. **Limits.** A 3×3 minimum and a 3×3 maximum of the cleaned image, each
   enlarged ×4 bilinearly. Every later result is clipped between them, so an
   edge can get steeper but can never overshoot into a halo.
3. **Enlarge ×4 along the edges.** Two ×2 steps of directional cubic
   interpolation (after Zhou, Shen and Tong, 2012). Each new pixel is
   interpolated with the cubic kernel `[−1, 9, 9, −1] / 16` along both
   candidate directions (the two diagonals, then row and column), and the two
   are blended with weights `1 / (1 + g⁵)`, where `g` is the local mean
   absolute luminance difference along that direction. The direction the image
   varies least along wins, so a slanted stroke stays a smooth slant. The
   result is then shifted by 1.5 pixels (Lanczos-4) to sit on the tile grid's
   pixel centres.
4. **Firm up the ink.** Two unsharp masks of the enlarged image, each clipped
   to the limits: a gentle one for parchment and colour washes (sigma 2,
   amount 0.3) and a stronger one for ink (sigma 2.5, amount 1.3). They are
   blended by the ink measure from step 1 (Gaussian sigma 0.7, enlarged ×4
   bicubically).
5. **One round of back-projection.** Shrink the result ×4 by area averaging,
   subtract from the cleaned image, enlarge the difference bicubically and add
   it back; clip to the limits. This ties the enlargement to the source.

## Step 3 — Cut and encode

- The ×4 image is laid on a canvas of whole tiles (38 × 25 at z6). The margin
  beyond the picture is filled with `(76, 105, 113)`.
- Each lower level is an exact 2:1 Lanczos reduction of the level above, taken
  from unencoded pixels, so every tile is compressed exactly once.
- `enhanced`: WebP quality 90, method 6.
- `original`: z4 is the decoded image on a 10 × 7 canvas; z3–z0 are the same
  2:1 reductions. WebP quality 98, method 6.

## Checks worth repeating

- **File set.** Every tile each level needs exists, and nothing past the
  deepest level. `tests/tiles.test.mjs` asserts this.
- **Alignment.** Markers are placed in image-pixel coordinates, so a new cut
  must not shift. Cross-correlating new tiles against old ones at every level
  should give a best offset of exactly zero. Resize libraries differ on
  pixel-centre conventions; this is where it shows.
- **Seams.** Extrapolate one pixel from each side of a tile border and compare.
  The mismatch should match the same test run inside the tiles.
- **Lettering.** Look at ×3–×4 close-ups of small labels on parchment and on
  water before accepting any change to step 2.

## What was tried and not kept

- **Shock filters and stroke-direction smoothing.** Tighter hatching, but small
  letters turned wobbly and colour washes went flat.
- **Sharpening a ring around the ink.** Turned the specks beside lettering into
  blocks. Sharpening is limited to the ink itself for that reason.
- **Pulling the pale ring beside lettering toward the background.** Erased
  faint hatching along with it.
- **Redrawing ink from its coverage.** Crisp on roads and large lettering, but
  in six-pixel lettering it could not tell a thin stroke from a gap and the
  fine detail washed out.
- **Cross-scale self-similarity.** A little better on small lettering, a little
  worse on hatching, about fifty times slower.
- **More back-projection rounds.** No visible change.

## What depends on the tiles

`scripts/gen-map-images.mjs` composites two flat images out of the `enhanced`
set: `public/faerun-map.webp`, shown behind the map canvas, and
`public/faerun-map-card.jpg`, the social preview card. It stitches every tile
at z3, crops the right and bottom margin away, and re-encodes each output from
that one buffer.

```bash
pnpm images
```

Both outputs are committed, like the tiles, so **re-cutting the tiles leaves
them stale until this is run**. The script restates the image dimensions,
native zoom, tile size and tile path from `lib/map/config.ts` rather than
importing them, since it is plain `.mjs` and that module is TypeScript behind a
path alias.

Tiles are served immutable for a year (`next.config.ts`). A re-cut therefore
needs a new address: bump the `v2` segment in `TILE_SETS` and move the folders
with it.
