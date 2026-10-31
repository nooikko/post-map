# How the tile pyramid was made

The tiles in `public/tiles/` are the artifact of record. The scripts that produced
them were one-time tools (Python + Pillow + numpy); they have been retired, and this
file is the surviving record of what they did.

They are not coming back as TypeScript. `sharp` has no equivalent of PIL's
`UnsharpMask(radius, percent, threshold)` semantics, `MaxFilter`, or the
`numpy.gradient`-driven composite masks below, so a port could not reproduce the
committed tiles — it would quietly produce *different* ones. Re-cutting the pyramid
from scratch is the honest option if it ever needs to change.

## Provenance

Wizards of the Coast published the 3rd-edition Faerûn map. That map is the source,
and they are the only party with rights in it. It has circulated freely for years.

This project worked from that map, enhanced it, and cut the pyramid served here.
See `NOTICE`.

Final pyramid: z0–z6, 1/2/6/20/70/247/950 tiles per level, 512×512 lossy WebP over
a 256px logical grid, `xyz` scheme.

## `clean_tiles.py`

Per tile, in order:

1. **Pixel-doubling detection in the unbuffered path.** A tile counts as pixel-doubled when ≥95% of its 2×2
   blocks have `std < 0.01`. Those were halved with an exact NEAREST decimation
   rather than resampled, recovering the true resolution instead of blurring an
   already-upscaled image.
2. **Resample** to the output size with `Image.LANCZOS`.
3. **Treatment** (see below).
4. **Encode**: `im.save(path, "WEBP", lossless=False, quality=90, method=6)`.

**Seam handling — `--buffer 8`.** Tiles were not processed in isolation. Each was
padded by 8px with the *real* pixels of its eight neighbours (`np.pad(mode="edge")`
at the map's outer edge), run through the filter chain, then cropped back. Filtering
a tile alone produces visible discontinuities at every tile border; this is why the
pyramid has none.

The shipped `--buffer 8` invocation uses `clean_tile_buffered`, which resamples
the padded tile directly. Although that function accepts the `undouble` argument,
it does not use it. The detection above describes the unbuffered code path,
not a step the shipped buffered run actually performed.

**Treatments.** Shipped setting was `sharpen-clean`.

| Treatment | Filters |
|---|---|
| `sharpen`, `sharpen-clean` | `UnsharpMask(radius=2, percent=90, threshold=2)` |
| `selective` | `UnsharpMask(radius=2, percent=120, threshold=0)` |
| `clean` | `UnsharpMask(radius=2, percent=110, threshold=0)` |

`sharpen-clean` uses `GaussianBlur(1.2)` to de-dither flat regions and
`GaussianBlur(1.0)` for soft masks. `MaxFilter(5) + GaussianBlur(1.5)` belongs
to the separate `selective` treatment and was not used by the shipped setting.
Flats and sharpened detail were recombined with
`Image.composite(flat, sharp3, soft(grad < flat_thresh))`, where `grad` came from
`numpy.gradient` — the point being to smooth parchment texture without softening
coastlines or lettering.

**Shipped invocation:** `--retina` (512px output), `--treatment sharpen-clean`,
`--buffer 8`, `--flat-thresh 10`, `--quality 90`.

## `rebuild_overviews.py`

Built z5→z0 bottom-up. For each parent: paste its four children onto a `ts*2`
canvas, then `resize((ts, ts), Image.LANCZOS)`. Missing children fell back to the
parchment fill `(245, 240, 225)`, or to a LANCZOS upscale of the original parent
where one existed.

`detect_scheme` resolved tms vs xyz empirically rather than assuming — it scored
mean-absolute-error across six sample parents under both interpretations. The
pyramid resolved to **xyz**, which is what `lib/map/config.ts` reads.

## `run_cleanup.sh`

The driver: stage the source map, `python3 -m venv` + `pip install pillow
numpy`, then the two scripts in sequence. No GDAL, ImageMagick, or `cwebp` — all
imaging ran in-process through Pillow.

## What now depends on the pyramid

`scripts/gen-map-images.mjs` composites two flat images back out of it —
`public/faerun-map.webp`, shown behind the map canvas, and
`public/faerun-map-card.jpg`, the social preview card. It stitches every tile at
z3, crops the pyramid's right and bottom margin away, and re-encodes each output
from that one buffer.

```bash
pnpm images
```

Both outputs are committed, like the tiles. The pyramid changes only when it is
regenerated, so running this at build time would spend seconds of every build
recomputing a byte-identical file — but it does mean **re-cutting the pyramid
leaves them stale until this is run**. They are the same artwork under the same
Fan Content Policy terms as the tiles, and `lib/licence-scope.ts` names them for
that reason.

The script restates `lib/map/config.ts`'s image dimensions, native zoom and tile
size rather than importing them, since it is plain `.mjs` and that module is
TypeScript behind a path alias. Changing either without the other is what a
mis-cropped poster looks like.
