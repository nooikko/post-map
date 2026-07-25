#!/usr/bin/env python3
"""Convert wiki article JSONs to the common schema.

Source: backend/Faerun/wiki-raw/ (raw MediaWiki action=parse responses,
post image stripping). If the raw dir is empty, falls back to
data/Faerun/wiki/ so the script also re-normalizes already-aligned files
in place — useful when the schema or normalization logic changes.

Sinks (both written identically):
  - data/Faerun/wiki/<encoded>.json (browser-served copy)
  - backend/Faerun/wiki/<encoded>.json (canonical store)

Idempotent.
"""
import argparse
import datetime as dt
import glob
import json
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "backend" / "Faerun" / "wiki-raw"
FRONT_DIR = ROOT / "data" / "Faerun" / "wiki"
BACK_DIR = ROOT / "backend" / "Faerun" / "wiki"
WIKI_HOST = "forgottenrealms.fandom.com"
API_BASE = f"https://{WIKI_HOST}/api.php"


def source_url(name: str) -> str:
    return f"{API_BASE}?action=parse&format=json&prop=text&page={urllib.parse.quote(name)}"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mtime_iso(path: Path) -> str:
    return dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def name_from_path(path: Path) -> str:
    return urllib.parse.unquote(path.stem)


def normalize(raw: dict, name: str, fetched_at: str) -> dict:
    """Map any of {raw mediawiki ok, raw mediawiki error, already-normalized}
    into the common schema."""
    if "status" in raw and "source" in raw and "name" in raw:
        # Already normalized — refresh nothing, just round-trip through the
        # schema field order so the on-disk file stays canonical.
        return shape({
            "name": raw["name"],
            "status": raw["status"],
            "title": raw.get("title"),
            "pageId": raw.get("pageId"),
            "html": raw.get("html"),
            "error": raw.get("error"),
            "source": {
                "wiki": raw["source"].get("wiki", WIKI_HOST),
                "url": raw["source"].get("url", source_url(name)),
                "fetchedAt": raw["source"].get("fetchedAt", fetched_at),
            },
        })

    src = {"wiki": WIKI_HOST, "url": source_url(name), "fetchedAt": fetched_at}

    if "error" in raw:
        err = raw["error"]
        code = err.get("code", "unknown")
        return shape({
            "name": name,
            "status": "missing" if code == "missingtitle" else "error",
            "title": None,
            "pageId": None,
            "html": None,
            "error": {"code": code, "info": err.get("info", "")},
            "source": src,
        })

    parse = raw.get("parse") or {}
    html = (parse.get("text") or {}).get("*")
    if html is None:
        return shape({
            "name": name,
            "status": "error",
            "title": None,
            "pageId": None,
            "html": None,
            "error": {"code": "no-content", "info": "response had no parse.text"},
            "source": src,
        })

    return shape({
        "name": name,
        "status": "ok",
        "title": parse.get("title"),
        "pageId": parse.get("pageid"),
        "html": html,
        "error": None,
        "source": src,
    })


# Enforce canonical key order so diffs stay readable across runs.
SCHEMA_KEYS = ("name", "status", "title", "pageId", "html", "error", "source")
SOURCE_KEYS = ("wiki", "url", "fetchedAt")


def shape(obj: dict) -> dict:
    out = {k: obj[k] for k in SCHEMA_KEYS}
    out["source"] = {k: obj["source"][k] for k in SOURCE_KEYS}
    return out


def write(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--touch-fetched-at",
        action="store_true",
        help="overwrite fetchedAt with now() instead of preserving file mtime",
    )
    args = ap.parse_args()

    src_dir = RAW_DIR if any(RAW_DIR.glob("*.json")) else FRONT_DIR
    files = sorted(glob.glob(str(src_dir / "*.json")))
    if not files:
        print(f"no files in {src_dir}", file=sys.stderr)
        return 1

    FRONT_DIR.mkdir(parents=True, exist_ok=True)
    BACK_DIR.mkdir(parents=True, exist_ok=True)
    stats = {"ok": 0, "missing": 0, "error": 0}
    for fp in files:
        path = Path(fp)
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        name = name_from_path(path)
        fetched = now_iso() if args.touch_fetched_at else mtime_iso(path)
        norm = normalize(raw, name, fetched)
        write(FRONT_DIR / path.name, norm)
        write(BACK_DIR / path.name, norm)
        stats[norm["status"]] += 1

    print(f"normalized {len(files)} files from {src_dir.name} → {FRONT_DIR} + {BACK_DIR}: {stats}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
