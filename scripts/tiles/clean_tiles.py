#!/usr/bin/env python3
"""
clean_tiles.py  -  de-jaggify a slippy-map tile pyramid (the "#2 Lanczos" pass)

What it does, per tile:
  1. Detects whether the tile is a 2x nearest-neighbor upscale of a half-res
     image (the source tiles are: 99%+ of 2x2 pixel blocks are identical).
     If so, it cleanly undoes the doubling first (exact, lossless) so we
     interpolate from the *real* pixels instead of the chunky doubled ones.
  2. Re-scales with a high-quality Lanczos kernel. This replaces the hard
     staircase edges with smooth gradients. No detail is invented; nothing
     is hallucinated. It is fully deterministic and repeatable.
  3. Writes the result out, mirroring the input directory structure.

Output is WebP -> drop-in replacement for the existing pyramid. By default
lossy q90 (much smaller, visually indistinguishable on this flat map art);
pass --lossless for the archival version.

USAGE
  python3 clean_tiles.py INPUT_DIR OUTPUT_DIR [options]

  # this project: seam-free @2x, sharpen-clean, lossy q90
  python3 clean_tiles.py ./Tiles ./Tiles_2x --retina \
      --treatment sharpen-clean --buffer 8 --quality 90

  python3 clean_tiles.py ./Tiles ./Tiles_clean --lossless     # archival
  python3 clean_tiles.py ./Tiles ./Tiles_clean --format png   # png instead of webp
  python3 clean_tiles.py ./Tiles ./Tiles_clean --no-undouble  # skip un-doubling

With --buffer N, each tile is padded with N native px of real neighbor pixels
before processing, so neighborhood filters (Lanczos/blur/unsharp/gradient) see
true context and tile seams vanish. The core output is pixel-identical to
processing the fully-stitched map. N=8 is ample for these kernels.

Requires: pillow, numpy   (pip install pillow numpy)
"""
import argparse, os, sys
from PIL import Image, ImageFilter
import numpy as np

def is_pixel_doubled(rgb: np.ndarray, thresh=0.95) -> bool:
    """True if >=thresh of aligned 2x2 blocks are perfectly constant."""
    h, w, _ = rgb.shape
    if h < 2 or w < 2 or h % 2 or w % 2:
        return False
    blocks = rgb.reshape(h // 2, 2, w // 2, 2, 3)
    const = (blocks.std(axis=(1, 3)) < 0.01).all(axis=-1)
    return const.mean() >= thresh

def apply_treatment(lanc: Image.Image, treatment: str, edge_thresh: int, flat_thresh: int) -> Image.Image:
    """
    plain     (#2): faithful Lanczos, nothing added.
    sharpen   (#3): global unsharp -> crisp text AND etched terrain (busier bg).
    selective (#4): sharpen only strong edges (text/roads); leave terrain calm.
    clean        (#5): sharpen only strong edges AND de-dither flat parchment
                       (terrain stays calm).
    sharpen-clean     : #3's GLOBAL unsharp everywhere (etched terrain) PLUS
                       de-dither of the flat parchment only.  << chosen treatment
    """
    if treatment == "plain":
        return lanc
    if treatment == "sharpen":
        return lanc.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))

    # gradient magnitude drives the zone masks for the de-dither / selective modes
    g = np.asarray(lanc.convert("L")).astype(np.float32)
    grad = np.hypot(np.abs(np.gradient(g, axis=1)), np.abs(np.gradient(g, axis=0)))

    def soft(cond):
        return (Image.fromarray((cond * 255).astype(np.uint8))
                .filter(ImageFilter.GaussianBlur(1.0)))

    flat = lanc.filter(ImageFilter.GaussianBlur(1.2))   # de-dithered flat parchment

    if treatment == "sharpen-clean":
        # #3 global unsharp everywhere, then restore smooth flats over the dither
        sharp3 = lanc.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
        return Image.composite(flat, sharp3, soft(grad < flat_thresh))

    if treatment == "selective":
        full = lanc.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=0))
        edge = (Image.fromarray(((grad > edge_thresh) * 255).astype(np.uint8))
                .filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5)))
        return Image.composite(full, lanc, edge)

    # clean (#5): selective sharpen + de-dither
    sharp = lanc.filter(ImageFilter.UnsharpMask(radius=2, percent=110, threshold=0))
    out = Image.composite(sharp, lanc, soft(grad > edge_thresh))   # sharpen strong edges
    out = Image.composite(flat, out, soft(grad < flat_thresh))     # de-dither true flats
    return out

def clean_tile(im: Image.Image, out_px: int, undouble: bool,
               treatment: str, edge_thresh: int, flat_thresh: int) -> Image.Image:
    im = im.convert("RGB")
    src = im
    if undouble:
        arr = np.asarray(im)
        if is_pixel_doubled(arr):
            # exact halving: take one sample per 2x2 block (blocks are constant)
            src = im.resize((im.width // 2, im.height // 2), Image.NEAREST)
    lanc = src.resize((out_px, out_px), Image.LANCZOS)
    return apply_treatment(lanc, treatment, edge_thresh, flat_thresh)

def _find_tile_path(input_dir, z, x, y, exts):
    base = os.path.join(input_dir, str(z), str(x))
    for e in exts:
        p = os.path.join(base, f"{y}{e}")
        if os.path.exists(p):
            return p
    return None

def _load_native_xy(input_dir, z, x, y, exts, undouble):
    """Load tile (z,x,y), undouble to native if applicable. None if missing."""
    p = _find_tile_path(input_dir, z, x, y, exts)
    if p is None:
        return None
    try:
        im = Image.open(p).convert("RGB")
    except Exception:
        return None
    if undouble and is_pixel_doubled(np.asarray(im)):
        im = im.resize((im.width // 2, im.height // 2), Image.NEAREST)
    return im

def clean_tile_buffered(input_dir, z, x, y, out_px, undouble,
                        treatment, edge_thresh, flat_thresh, exts, buffer):
    """
    Seam-free processing: pad the tile's NATIVE image with a margin of real
    neighbor pixels, run the full pipeline (Lanczos + treatment) on the padded
    tile so every core pixel sees its true neighborhood, then crop the margin
    off. The core is pixel-identical to processing the fully-stitched map.
    Missing neighbors (map edge) are edge-replicated.
    """
    center = _load_native_xy(input_dir, z, x, y, exts, undouble)
    if center is None:
        raise FileNotFoundError(f"tile {z}/{x}/{y}")
    n = center.width
    B = buffer
    if center.height != n or B <= 0:
        lanc = center.resize((out_px, out_px), Image.LANCZOS)
        return apply_treatment(lanc, treatment, edge_thresh, flat_thresh)

    padded = np.pad(np.asarray(center), ((B, B), (B, B), (0, 0)), mode="edge")

    def put(nx, ny, dst_rows, dst_cols, src_slice):
        nb = _load_native_xy(input_dir, z, nx, ny, exts, undouble)
        if nb is not None and nb.size == center.size:
            padded[dst_rows, dst_cols] = np.asarray(nb)[src_slice]

    # 4 edges
    put(x-1, y,   slice(B, B+n),       slice(0, B),         np.s_[:, n-B:n])
    put(x+1, y,   slice(B, B+n),       slice(B+n, n+2*B),   np.s_[:, 0:B])
    put(x,   y-1, slice(0, B),         slice(B, B+n),       np.s_[n-B:n, :])
    put(x,   y+1, slice(B+n, n+2*B),   slice(B, B+n),       np.s_[0:B, :])
    # 4 corners
    put(x-1, y-1, slice(0, B),         slice(0, B),         np.s_[n-B:n, n-B:n])
    put(x+1, y-1, slice(0, B),         slice(B+n, n+2*B),   np.s_[n-B:n, 0:B])
    put(x-1, y+1, slice(B+n, n+2*B),   slice(0, B),         np.s_[0:B, n-B:n])
    put(x+1, y+1, slice(B+n, n+2*B),   slice(B+n, n+2*B),   np.s_[0:B, 0:B])

    big_side = round((n + 2*B) * out_px / n)
    big = Image.fromarray(padded).resize((big_side, big_side), Image.LANCZOS)
    treated = apply_treatment(big, treatment, edge_thresh, flat_thresh)
    m = round(B * out_px / n)
    return treated.crop((m, m, m + out_px, m + out_px))

def save_tile(im: Image.Image, path: str, fmt: str, lossless: bool, quality: int):
    if fmt == "webp":
        im.save(path, "WEBP", lossless=lossless, quality=quality, method=6)
    else:
        im.save(path, "PNG", optimize=True)

def main():
    ap = argparse.ArgumentParser(description="De-jaggify a map tile pyramid (Lanczos pass).")
    ap.add_argument("input_dir")
    ap.add_argument("output_dir")
    ap.add_argument("--format", choices=["webp", "png"], default="webp",
                    help="output format (default: webp)")
    ap.add_argument("--lossless", dest="lossless", action="store_true", default=False,
                    help="webp: lossless (archival, larger). Default is lossy.")
    ap.add_argument("--lossy", dest="lossless", action="store_false",
                    help="webp: lossy at --quality (default)")
    ap.add_argument("--quality", type=int, default=90,
                    help="webp lossy quality 0-100 (default 90; ignored when --lossless)")
    ap.add_argument("--retina", action="store_true",
                    help="output 512px @2x tiles instead of 256 (needs map @2x config)")
    ap.add_argument("--treatment", choices=["plain", "sharpen", "selective", "clean", "sharpen-clean"], default="plain",
                    help="plain=#2 faithful (default), sharpen=#3 global, selective=#4, clean=#5, sharpen-clean=#3+de-dither")
    ap.add_argument("--edge-thresh", type=int, default=28,
                    help="selective/clean: edge gradient threshold (sharpen above this)")
    ap.add_argument("--flat-thresh", type=int, default=10,
                    help="clean mode: gradient below this = flat, gets de-dithered")
    ap.add_argument("--buffer", type=int, default=0,
                    help="seam-free: pad tiles with N native px of real neighbor "
                         "context (recommended 8). 0 = independent per-tile (has seams).")
    ap.add_argument("--no-undouble", dest="undouble", action="store_false",
                    help="do not try to undo 2x pixel-doubling")
    ap.add_argument("--exts", default=".png,.jpg,.jpeg,.webp",
                    help="comma-separated input extensions to process")
    ap.add_argument("--only-zoom", type=int, default=None,
                    help="process only this zoom level (parsed from {z}/{x}/{y} path)")
    args = ap.parse_args()

    out_px = 512 if args.retina else 256
    exts = tuple(e.strip().lower() for e in args.exts.split(","))
    out_ext = ".webp" if args.format == "webp" else ".png"

    n_done = n_skip = 0
    for root, _, files in os.walk(args.input_dir):
        rel = os.path.relpath(root, args.input_dir)
        out_root = os.path.join(args.output_dir, rel) if rel != "." else args.output_dir
        for fname in files:
            if not fname.lower().endswith(exts):
                n_skip += 1
                continue
            if args.only_zoom is not None:
                try:
                    if int(os.path.basename(os.path.dirname(root))) != args.only_zoom:
                        n_skip += 1
                        continue
                except ValueError:
                    n_skip += 1
                    continue
            in_path = os.path.join(root, fname)
            out_name = os.path.splitext(fname)[0] + out_ext
            out_path = os.path.join(out_root, out_name)
            os.makedirs(out_root, exist_ok=True)
            try:
                if args.buffer > 0:
                    # parse z/x/y from the .../{z}/{x}/{y}.ext layout
                    try:
                        zz = int(os.path.basename(os.path.dirname(root)))
                        xx = int(os.path.basename(root))
                        yy = int(os.path.splitext(fname)[0])
                    except ValueError:
                        zz = xx = yy = None
                    if zz is not None:
                        cleaned = clean_tile_buffered(
                            args.input_dir, zz, xx, yy, out_px, args.undouble,
                            args.treatment, args.edge_thresh, args.flat_thresh,
                            exts, args.buffer)
                    else:  # path doesn't match z/x/y -> independent fallback
                        with Image.open(in_path) as im:
                            cleaned = clean_tile(im, out_px, args.undouble,
                                                 args.treatment, args.edge_thresh, args.flat_thresh)
                else:
                    with Image.open(in_path) as im:
                        cleaned = clean_tile(im, out_px, args.undouble,
                                             args.treatment, args.edge_thresh, args.flat_thresh)
                save_tile(cleaned, out_path, args.format, args.lossless, args.quality)
                n_done += 1
                if n_done % 200 == 0:
                    print(f"  ...{n_done} tiles", file=sys.stderr)
            except Exception as e:
                print(f"  ! skip {in_path}: {e}", file=sys.stderr)
                n_skip += 1

    kind = "lossless" if args.lossless else f"lossy q{args.quality}"
    print(f"Done. Cleaned {n_done} tiles -> {args.output_dir}  ({out_px}px {args.format} {kind}). "
          f"Skipped {n_skip} non-image files.")

if __name__ == "__main__":
    main()
