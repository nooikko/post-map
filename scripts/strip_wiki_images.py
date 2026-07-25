#!/usr/bin/env python3
"""Strip image-bearing markup from every cached wiki article in place.

We don't render images in the popup, so anything image-related in the
saved HTML is dead weight. Removes:
  - <img>, <figure>, <picture>, <noscript>, <svg>, <map>, <area>, <source>
  - elements whose class set intersects a known image/thumbnail set
    (.image, .thumb, .thumbinner, .thumbcaption, .thumbimage,
     .gallery, .gallery-image-wrapper, .image-thumbnail,
     .image-no-lightbox, .pi-image, .pi-image-thumbnail,
     .pi-image-collection)
  - infobox rows with data-source="image"
  - <a> tags pointing at static.wikia.nocookie.net (image link wrappers)

Operates on backend/Faerun/wiki-raw/ in place.
Re-runnable; idempotent. Run after scripts/fetch_wiki.py and before
scripts/normalize_wiki.py.
Requires beautifulsoup4 (use a venv if Python is externally managed).
"""
import glob
import json
import sys
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.stderr.write(
        "beautifulsoup4 not installed. Try:\n"
        "  python3 -m venv .venv && .venv/bin/pip install beautifulsoup4\n"
        "  .venv/bin/python scripts/strip_wiki_images.py\n"
    )
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "backend" / "Faerun" / "wiki-raw"

DROP_TAGS = {"img", "figure", "picture", "noscript", "svg", "map", "area", "source"}
DROP_CLASSES = {
    "image",
    "image-thumbnail",
    "image-no-lightbox",
    "thumb",
    "thumbinner",
    "thumbimage",
    "thumbcaption",
    "gallery",
    "gallery-image-wrapper",
    "pi-image",
    "pi-image-thumbnail",
    "pi-image-collection",
}


def strip(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for tag in list(soup.find_all(list(DROP_TAGS))):
        tag.decompose()

    for tag in list(soup.find_all(attrs={"class": True})):
        if tag.decomposed:
            continue
        if DROP_CLASSES.intersection(tag.get("class", []) or []):
            tag.decompose()

    for tag in list(soup.find_all(attrs={"data-source": "image"})):
        if not tag.decomposed:
            tag.decompose()

    for a in list(soup.find_all("a", href=True)):
        if a.decomposed:
            continue
        if "static.wikia.nocookie.net" in a["href"]:
            a.decompose()

    return str(soup)


def main() -> int:
    files = sorted(glob.glob(str(RAW_DIR / "*.json")))
    changed = 0
    skipped_no_html = 0
    for fp in files:
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        html = (data.get("parse") or {}).get("text", {}).get("*")
        if not html:
            skipped_no_html += 1
            continue
        new_html = strip(html)
        if new_html == html:
            continue
        data["parse"]["text"]["*"] = new_html
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        changed += 1
    print(f"scanned {len(files)} files, rewrote {changed}, skipped {skipped_no_html} (no html)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
