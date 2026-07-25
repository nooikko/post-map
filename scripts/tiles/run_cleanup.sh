#!/usr/bin/env bash
#
# run_cleanup.sh - fetch the source Faerûn map, clean them, emit WebP, and
# install the result into this repo's public/tiles so the Vite app serves it.
#
# End to end:
#   1. shallow-clone the original tile pyramid from GitHub
#   2. install python deps (pillow, numpy)
#   3. clean the detail tier z6: un-double -> Lanczos -> sharpen-clean
#      (+de-dither), seam-free via neighbor buffering, @2x (512px)
#   4. rebuild overviews z5..z0 from the cleaned z6 (every tier derives from
#      the clean master)
#   5. carry over non-image pyramid metadata
#   6. install into ../../public/tiles (replacing the current set)
#
# Output: 512px @2x WebP, matching the OpenLayers @2x multi-resolution grid in
# src/map-core.js (tileSize 256 + tilePixelRatio 2). Requires clean_tiles.py and
# rebuild_overviews.py alongside this script.
#
# Usage: scripts/tiles/run_cleanup.sh   (edit the CONFIG block below to taste)

set -euo pipefail

# ----------------------------- CONFIG ---------------------------------------
REPO_URL="$SOURCE_TILES_REPO"
BRANCH="master"
SRC_DIR="source-map"     # where the originals are staged (gitignored)
TILES_SUBDIR="Tiles"              # tile root inside the repo: {z}/{x}/{y}.png
OUT_DIR="Tiles_clean"             # staging output (gitignored): {z}/{x}/{y}.webp

TREATMENT="sharpen-clean"         # plain | sharpen | selective | clean | sharpen-clean
RETINA="--retina"                 # "" for 256px tiles, "--retina" for 512 @2x
BUFFER="8"                        # neighbor padding (native px); seam-free. 0 to disable
FLAT_THRESH="10"                  # de-dither aggressiveness (lower = de-dither more)
FORMAT="webp"                     # webp | png

# Compression. Lossy q90 keeps the @2x pyramid small enough for cheap Vercel
# transfer while staying visually clean on this flat map art. Set LOSSLESS="yes"
# for an archival pass (much larger).
LOSSLESS="no"                     # "yes" -> lossless webp, ignores QUALITY
QUALITY="90"                      # webp lossy quality 0-100

# --- Option 3: clean only the detail tier, derive the rest from it ---
MAX_ZOOM="6"                      # the detail/top zoom to actually clean
REBUILD_OVERVIEWS="yes"           # "yes" -> regenerate z(MAX-1)..0 from the cleaned top
MIN_ZOOM="0"                      # lowest zoom to rebuild down to

# Install the finished pyramid into the app (public/tiles). "no" leaves it in
# the staging OUT_DIR for you to inspect/move manually.
INSTALL_TO_PUBLIC="yes"
# ----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PUBLIC_TILES="$REPO_ROOT/public/tiles"

# Resolve clone/staging dirs relative to this script so the artifacts stay put
# regardless of where the script is invoked from.
SRC_DIR="$SCRIPT_DIR/$SRC_DIR"
OUT_DIR="$SCRIPT_DIR/$OUT_DIR"
TILES_IN="$SRC_DIR/$TILES_SUBDIR"

# Compression args shared by both python passes.
if [ "$LOSSLESS" = "yes" ]; then
  COMPRESS_ARGS=(--lossless)
else
  COMPRESS_ARGS=(--lossy --quality "$QUALITY")
fi

echo "==> 1/6  Cloning originals ($BRANCH) ..."
if [ -d "$SRC_DIR/.git" ]; then
  echo "    $SRC_DIR already cloned; pulling latest."
  git -C "$SRC_DIR" pull --ff-only
else
  # shallow, single-branch clone keeps the download to the current tile set only
  git clone --depth 1 --single-branch --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi

if [ ! -d "$TILES_IN" ]; then
  echo "ERROR: expected tiles at '$TILES_IN' but it does not exist." >&2
  echo "       Check TILES_SUBDIR in the CONFIG block." >&2
  exit 1
fi

echo "==> 2/6  Installing python deps ..."
# Use a local venv so we don't fight PEP 668 (externally-managed Homebrew
# Python) and don't pollute the system site-packages.
PY="python3"
if ! python3 -c 'import PIL, numpy' >/dev/null 2>&1; then
  VENV="$SCRIPT_DIR/.venv"
  if [ ! -x "$VENV/bin/python" ]; then
    echo "    creating venv at $VENV"
    python3 -m venv "$VENV"
  fi
  "$VENV/bin/python" -m pip install --quiet --upgrade pip
  "$VENV/bin/python" -m pip install --quiet --upgrade pillow numpy
  PY="$VENV/bin/python"
fi
echo "    python: $("$PY" -c 'import sys,PIL,numpy; print(sys.executable, "PIL", PIL.__version__, "numpy", numpy.__version__)')"

IN_COUNT=$(find "$TILES_IN" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | wc -l | tr -d ' ')
echo "    source tiles found: $IN_COUNT"

echo "==> 3/6  Cleaning detail tier z$MAX_ZOOM (treatment=$TREATMENT, buffer=$BUFFER, retina=${RETINA:-off}) ..."
"$PY" "$SCRIPT_DIR/clean_tiles.py" "$TILES_IN" "$OUT_DIR" \
  $RETINA \
  --treatment "$TREATMENT" \
  --buffer "$BUFFER" \
  --flat-thresh "$FLAT_THRESH" \
  --format "$FORMAT" \
  "${COMPRESS_ARGS[@]}" \
  --only-zoom "$MAX_ZOOM"

echo "==> 4/6  Rebuilding overviews z$((MAX_ZOOM-1))..$MIN_ZOOM from the cleaned tier ..."
if [ "$REBUILD_OVERVIEWS" = "yes" ]; then
  "$PY" "$SCRIPT_DIR/rebuild_overviews.py" "$OUT_DIR" \
    --orig "$TILES_IN" \
    --max-zoom "$MAX_ZOOM" \
    --min-zoom "$MIN_ZOOM" \
    --format "$FORMAT" \
    "${COMPRESS_ARGS[@]}" \
    --scheme auto
else
  echo "    skipped (REBUILD_OVERVIEWS != yes)."
fi

echo "==> 5/6  Carrying over non-image pyramid metadata ..."
# carry over any non-image pyramid metadata (tilemapresource.xml, etc.) so the
# output remains a complete, valid tile set
while IFS= read -r -d '' f; do
  rel="${f#"$TILES_IN"/}"
  mkdir -p "$OUT_DIR/$(dirname "$rel")"
  cp "$f" "$OUT_DIR/$rel"
done < <(find "$TILES_IN" -type f ! \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) -print0)

OUT_COUNT=$(find "$OUT_DIR" -type f -iname "*.$FORMAT" | wc -l | tr -d ' ')
OUT_BYTES=$(find "$OUT_DIR" -type f -iname "*.$FORMAT" -exec ls -l {} \; | awk '{s+=$5} END {printf "%.1f", s/1048576}')
echo "    output tiles written: $OUT_COUNT  (~${OUT_BYTES} MB into $OUT_DIR)"

echo "==> 6/6  Installing into the app ..."
if [ "$INSTALL_TO_PUBLIC" = "yes" ]; then
  echo "    replacing $PUBLIC_TILES (old set is recoverable via git)."
  rm -rf "$PUBLIC_TILES"
  mkdir -p "$(dirname "$PUBLIC_TILES")"
  # move just the {z}/ dirs (skip any stray metadata at the staging root)
  mkdir -p "$PUBLIC_TILES"
  for z in $(seq "$MIN_ZOOM" "$MAX_ZOOM"); do
    [ -d "$OUT_DIR/$z" ] && mv "$OUT_DIR/$z" "$PUBLIC_TILES/$z"
  done
  echo "    installed $(find "$PUBLIC_TILES" -type f -iname "*.$FORMAT" | wc -l | tr -d ' ') tiles -> $PUBLIC_TILES"
else
  echo "    skipped (INSTALL_TO_PUBLIC != yes). Tiles staged in $OUT_DIR."
fi

echo ""
echo "Done. The app serves public/tiles/{z}/{x}/{y}.$FORMAT."
echo "OpenLayers is already configured for @2x ${RETINA:+512px }tiles across z$MIN_ZOOM..$MAX_ZOOM in src/map-core.js."
