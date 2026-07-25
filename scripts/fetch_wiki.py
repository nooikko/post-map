#!/usr/bin/env python3
"""Download every marker's Forgotten Realms wiki article to disk.

Reads marker names from data/Faerun/*.json, hits the MediaWiki action=parse
API once per unique name, and writes the raw JSON response to
backend/Faerun/wiki-raw/<urlencoded-name>.json. The raw store preserves the
verbatim API response so downstream transforms (image stripping, schema
normalization) stay reproducible.

Pipeline: fetch → scripts/strip_wiki_images.py → scripts/normalize_wiki.py.

Re-runnable: existing files are skipped unless --force is passed.
"""
import argparse
import concurrent.futures as cf
import glob
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAYERS_DIR = ROOT / "data" / "Faerun"
RAW_DIR = ROOT / "backend" / "Faerun" / "wiki-raw"
API = "https://forgottenrealms.fandom.com/api.php"
UA = "post-map/1.0 (local offline mirror; personal project)"


def unique_names() -> list[str]:
    names: set[str] = set()
    for fp in sorted(glob.glob(str(LAYERS_DIR / "*.json"))):
        with open(fp, encoding="utf-8-sig") as f:
            geo = json.load(f)
        for feat in geo.get("features", []):
            nm = feat.get("properties", {}).get("name")
            if nm:
                names.add(nm)
    return sorted(names)


def target_path(name: str) -> Path:
    return RAW_DIR / f"{urllib.parse.quote(name, safe='')}.json"


def fetch_one(name: str, force: bool) -> tuple[str, str]:
    out = target_path(name)
    if out.exists() and not force:
        return (name, "skip")
    url = f"{API}?action=parse&format=json&prop=text&page={urllib.parse.quote(name)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except Exception as e:
        return (name, f"err:{e}")
    try:
        data = json.loads(raw)
    except Exception as e:
        return (name, f"badjson:{e}")
    out.write_bytes(raw)
    if "error" in data:
        return (name, f"wiki-error:{data['error'].get('code', '?')}")
    return (name, "ok")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-download even if file exists")
    ap.add_argument("--workers", type=int, default=4, help="parallel requests (default 4)")
    args = ap.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    names = unique_names()
    print(f"{len(names)} unique names; workers={args.workers} force={args.force}")

    start = time.time()
    counts = {"ok": 0, "skip": 0, "err": 0, "wiki-error": 0, "badjson": 0}
    errors: list[tuple[str, str]] = []

    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(fetch_one, n, args.force): n for n in names}
        done = 0
        for fut in cf.as_completed(futures):
            name, status = fut.result()
            done += 1
            bucket = status.split(":", 1)[0]
            counts[bucket] = counts.get(bucket, 0) + 1
            if bucket not in ("ok", "skip"):
                errors.append((name, status))
            if done % 25 == 0 or done == len(names):
                print(f"  [{done}/{len(names)}] {counts}")

    dur = time.time() - start
    print(f"done in {dur:.1f}s: {counts}")
    if errors:
        print(f"first 10 errors:")
        for n, s in errors[:10]:
            print(f"  {n}: {s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
