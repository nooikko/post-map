#!/usr/bin/env python3
"""
rebuild_overviews.py - regenerate lower zoom levels of a tile pyramid from the
cleaned top level, so every tier derives from the clean master (Option 3).

For each parent tile (z, x, y) it gathers the 2x2 block of children at z+1,
arranges them correctly for the pyramid's scheme, and downscales 2:1 (Lanczos)
into the parent. Works top-down: z(max-1) is built from cleaned z(max), then
z(max-2) from the freshly built z(max-1), ... down to min-zoom. No sharpening or
de-dithering is applied -- overviews are zoomed-out, so a clean downscale of
already-clean tiles is exactly what you want.

CHILD -> PARENT geometry
  x increases eastward in every scheme: left child = 2x,  right child = 2x+1.
  y depends on the scheme:
    TMS  (gdal2tiles / MapTiler default): y increases NORTH, so the TOP half of
         a parent is the child with the HIGHER y -> 2y+1 on top, 2y on bottom.
    XYZ  (Google / OSM / Leaflet default): y increases SOUTH -> 2y on top.
  This pyramid auto-detects as XYZ (the tilemapresource.xml suggests TMS, but the
  tiles are actually laid out XYZ-style -- which is why --scheme defaults to 'auto'
  and verifies empirically against the originals rather than trusting metadata).
  Get this wrong and parents come out vertically mirrored, hence the auto-check.

Tile set: parents are built for exactly the (x,y) that exist at each zoom in the
--orig pyramid, so the rebuilt pyramid matches the original's coverage. For a
parent missing one or more children, the corresponding quadrant falls back to the
original parent tile's content (which at map edges is just background).

USAGE
  python3 rebuild_overviews.py PYRAMID_DIR --orig ORIG_TILES_DIR \
      --max-zoom 6 --format webp --quality 90 --scheme auto
"""
import argparse, os, sys
from PIL import Image


def find_path(root, z, x, y, exts):
    base = os.path.join(root, str(z), str(x))
    for e in exts:
        p = os.path.join(base, f"{y}{e}")
        if os.path.exists(p):
            return p
    return None


def load(root, z, x, y, exts):
    p = find_path(root, z, x, y, exts)
    if p is None:
        return None
    try:
        return Image.open(p).convert("RGB")
    except Exception:
        return None


def parents_at_zoom(orig_dir, z, exts):
    """(x, y) of every tile present at zoom z in the original pyramid."""
    out = []
    zdir = os.path.join(orig_dir, str(z))
    if not os.path.isdir(zdir):
        return out
    for xname in os.listdir(zdir):
        xdir = os.path.join(zdir, xname)
        if not (os.path.isdir(xdir) and xname.isdigit()):
            continue
        for fname in os.listdir(xdir):
            base, ext = os.path.splitext(fname)
            if ext.lower() in exts and base.isdigit():
                out.append((int(xname), int(base)))
    return out


def child_coords(x, y, dx, dy, scheme):
    """dx: 0=left,1=right ; dy: 0=top,1=bottom -> (cx, cy) at z+1."""
    cx = 2 * x + dx
    if scheme == "tms":
        cy = 2 * y + (1 - dy)   # top=2y+1, bottom=2y
    else:                       # xyz
        cy = 2 * y + dy         # top=2y,   bottom=2y+1
    return cx, cy


def build_parent(pyramid_dir, orig_dir, z, x, y, exts, ts, scheme):
    canvas = Image.new("RGB", (ts * 2, ts * 2), (245, 240, 225))  # cream fallback
    base = load(orig_dir, z, x, y, exts) if orig_dir else None
    if base is not None:
        canvas = base.resize((ts * 2, ts * 2), Image.LANCZOS)
    placed = 0
    for dy in (0, 1):
        for dx in (0, 1):
            cx, cy = child_coords(x, y, dx, dy, scheme)
            child = load(pyramid_dir, z + 1, cx, cy, exts)
            if child is not None:
                if child.size != (ts, ts):
                    child = child.resize((ts, ts), Image.LANCZOS)
                canvas.paste(child, (dx * ts, dy * ts))
                placed += 1
    if placed == 0:
        return None
    return canvas.resize((ts, ts), Image.LANCZOS)


def save_tile(im, path, fmt, lossless, quality):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if fmt == "webp":
        im.save(path, "WEBP", lossless=lossless, quality=quality, method=6)
    else:
        im.save(path, "PNG", optimize=True)


def detect_max_zoom(pyramid_dir):
    zs = [int(d) for d in os.listdir(pyramid_dir)
          if d.isdigit() and os.path.isdir(os.path.join(pyramid_dir, d))]
    return max(zs) if zs else None


def detect_tile_size(pyramid_dir, max_zoom, exts):
    zdir = os.path.join(pyramid_dir, str(max_zoom))
    for xname in os.listdir(zdir):
        xdir = os.path.join(zdir, xname)
        if not os.path.isdir(xdir):
            continue
        for fname in os.listdir(xdir):
            if os.path.splitext(fname)[1].lower() in exts:
                with Image.open(os.path.join(xdir, fname)) as im:
                    return im.width
    return 512


def detect_scheme(orig_dir, max_zoom, exts, ts, samples=6):
    """Empirically decide tms vs xyz: rebuild a few parents from ORIGINAL children
    both ways and compare to the real ORIGINAL parent; lower error wins. This is
    bulletproof vs guessing from metadata (which can lie)."""
    import numpy as np
    z = max_zoom - 1
    parents = parents_at_zoom(orig_dir, z, exts)
    err = {"tms": 0.0, "xyz": 0.0}
    used = 0
    for (x, y) in parents:
        real = load(orig_dir, z, x, y, exts)
        if real is None:
            continue
        # only use parents whose 4 children all exist (clean comparison)
        if any(load(orig_dir, z + 1, *child_coords(x, y, dx, dy, "xyz"), exts) is None
               for dy in (0, 1) for dx in (0, 1)):
            continue
        a = np.asarray(real.resize((ts, ts), Image.LANCZOS)).astype(float)
        for s in ("tms", "xyz"):
            built = build_parent(orig_dir, None, z, x, y, exts, ts, s)
            err[s] += np.abs(a - np.asarray(built).astype(float)).mean()
        used += 1
        if used >= samples:
            break
    if used == 0:
        return "xyz", "no full-child parents to test; defaulting xyz"
    winner = min(err, key=err.get)
    return winner, f"tested {used} parents: tms={err['tms']/used:.1f} xyz={err['xyz']/used:.1f} -> {winner}"


def main():
    ap = argparse.ArgumentParser(description="Rebuild pyramid overviews from the cleaned top zoom.")
    ap.add_argument("pyramid_dir", help="cleaned pyramid root (top zoom present; parents written here)")
    ap.add_argument("--orig", default=None,
                    help="original Tiles dir: defines which tiles exist + edge fallback (recommended)")
    ap.add_argument("--max-zoom", type=int, default=None, help="top zoom present (auto-detected if omitted)")
    ap.add_argument("--min-zoom", type=int, default=0)
    ap.add_argument("--format", choices=["webp", "png"], default="webp")
    ap.add_argument("--lossless", dest="lossless", action="store_true", default=False,
                    help="webp: lossless (archival, larger). Default is lossy.")
    ap.add_argument("--lossy", dest="lossless", action="store_false",
                    help="webp: lossy at --quality (default)")
    ap.add_argument("--quality", type=int, default=90,
                    help="webp lossy quality 0-100 (default 90; ignored when --lossless)")
    ap.add_argument("--scheme", choices=["auto", "tms", "xyz"], default="auto",
                    help="tile y-axis scheme; 'auto' detects it from the originals (recommended)")
    args = ap.parse_args()

    exts = (".png", ".jpg", ".jpeg", ".webp")
    out_ext = ".webp" if args.format == "webp" else ".png"

    max_zoom = args.max_zoom if args.max_zoom is not None else detect_max_zoom(args.pyramid_dir)
    if max_zoom is None:
        print("ERROR: no numeric zoom dirs found in pyramid.", file=sys.stderr)
        sys.exit(1)
    ts = detect_tile_size(args.pyramid_dir, max_zoom, exts)

    scheme = args.scheme
    if scheme == "auto":
        if not args.orig:
            scheme = "xyz"
            print("WARNING: --scheme auto needs --orig; defaulting to xyz.")
        else:
            scheme, why = detect_scheme(args.orig, max_zoom, exts, ts)
            print(f"scheme auto-detect: {why}")
    print(f"max zoom={max_zoom}, tile size={ts}px, scheme={scheme}")

    total = 0
    for z in range(max_zoom - 1, args.min_zoom - 1, -1):
        if args.orig:
            parents = parents_at_zoom(args.orig, z, exts)
        else:
            # derive from children present one level up
            seen = set()
            cz = os.path.join(args.pyramid_dir, str(z + 1))
            for xname in os.listdir(cz) if os.path.isdir(cz) else []:
                xdir = os.path.join(cz, xname)
                if not (os.path.isdir(xdir) and xname.isdigit()):
                    continue
                for fname in os.listdir(xdir):
                    base, ext = os.path.splitext(fname)
                    if ext.lower() in exts and base.isdigit():
                        seen.add((int(xname) // 2, int(base) // 2))
            parents = sorted(seen)
        n = 0
        for (x, y) in parents:
            tile = build_parent(args.pyramid_dir, args.orig, z, x, y, exts, ts, scheme)
            if tile is not None:
                save_tile(tile, os.path.join(args.pyramid_dir, str(z), str(x), f"{y}{out_ext}"),
                          args.format, args.lossless, args.quality)
                n += 1
        print(f"  z{z}: built {n} tiles")
        total += n
    print(f"Done. Rebuilt {total} overview tiles in {args.pyramid_dir}.")


if __name__ == "__main__":
    main()
