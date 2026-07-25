#!/usr/bin/env python3
"""Fetch the canonical articles that our redirect-stub markers point at.

Several markers (e.g. Velprintalar, Ithmong) resolve to wiki redirect stubs
whose real content lives under a renamed/respelled title (Veltalar, Darromar).
Only a few of those targets were in the original mirror, so the panel could
only show a "recorded in the lore as X" note. This script scans the mirror for
redirect stubs, finds the targets we're missing, fetches them through the same
fetch -> strip-images -> normalize pipeline, and writes them under the TARGET
name so the runtime's redirect-follow resolves to a full article.

Run: .venv/bin/python scripts/fetch_redirect_targets.py
Idempotent; skips targets already present unless --force.
"""
import argparse
import datetime as dt
import glob
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
FRONT_DIR = ROOT / "public" / "data" / "Faerun" / "wiki"
BACK_DIR = ROOT / "backend" / "Faerun" / "wiki"
WIKI_HOST = "forgottenrealms.fandom.com"
API = f"https://{WIKI_HOST}/api.php"
UA = "post-map/1.0 (local offline mirror; personal project)"

DROP_TAGS = {"img", "figure", "picture", "noscript", "svg", "map", "area", "source"}
DROP_CLASSES = {
    "image", "image-thumbnail", "image-no-lightbox", "thumb", "thumbinner",
    "thumbimage", "thumbcaption", "gallery", "gallery-image-wrapper",
    "pi-image", "pi-image-thumbnail", "pi-image-collection",
}


def strip_images(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in list(soup.find_all(list(DROP_TAGS))):
        tag.decompose()
    for tag in list(soup.find_all(attrs={"class": True})):
        if not tag.decomposed and DROP_CLASSES.intersection(tag.get("class", []) or []):
            tag.decompose()
    for tag in list(soup.find_all(attrs={"data-source": "image"})):
        if not tag.decomposed:
            tag.decompose()
    for a in list(soup.find_all("a", href=True)):
        if not a.decomposed and "static.wikia.nocookie.net" in a["href"]:
            a.decompose()
    return str(soup)


def redirect_target(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    msg = soup.select_one(".redirectMsg .redirectText a, .redirectMsg a")
    if not msg:
        return None
    return (msg.get("title") or msg.get_text()).strip() or None


def safe_name(name: str) -> bool:
    """Only bare filenames — no path separators or dot components that could
    write outside the wiki dirs."""
    return bool(name) and name == Path(name).name and name not in {".", ".."}


def find_missing_targets() -> list[str]:
    have = {Path(p).stem for p in glob.glob(str(FRONT_DIR / "*.json"))}
    targets: set[str] = set()
    for fp in glob.glob(str(FRONT_DIR / "*.json")):
        try:
            with open(fp, encoding="utf-8") as f:
                art = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"  warning: skipping unreadable {fp}: {e}")
            continue
        if art.get("status") != "ok" or not art.get("html"):
            continue
        tgt = redirect_target(art["html"])
        if not tgt:
            continue
        if tgt.lower().endswith("(disambiguation)"):
            continue  # disambiguation pages aren't real articles
        if not safe_name(tgt):
            print(f"  warning: skipping unsafe redirect target {tgt!r} in {fp}")
            continue
        if tgt not in have:
            targets.add(tgt)
    return sorted(targets)


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def source_url(name: str) -> str:
    return f"{API}?action=parse&format=json&prop=text&page={urllib.parse.quote(name)}"


def fetch(name: str) -> dict:
    req = urllib.request.Request(source_url(name), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


SCHEMA_KEYS = ("name", "status", "title", "pageId", "html", "error", "source")


def normalize(raw: dict, name: str) -> dict:
    src = {"wiki": WIKI_HOST, "url": source_url(name), "fetchedAt": now_iso()}
    if "error" in raw:
        err = raw["error"]
        code = err.get("code", "unknown")
        obj = {"name": name, "status": "missing" if code == "missingtitle" else "error",
               "title": None, "pageId": None, "html": None,
               "error": {"code": code, "info": err.get("info", "")}, "source": src}
    else:
        parse = raw.get("parse") or {}
        html = (parse.get("text") or {}).get("*")
        if html is None:
            obj = {"name": name, "status": "error", "title": None, "pageId": None,
                   "html": None, "error": {"code": "no-content", "info": "no parse.text"},
                   "source": src}
        else:
            obj = {"name": name, "status": "ok", "title": parse.get("title"),
                   "pageId": parse.get("pageid"), "html": strip_images(html),
                   "error": None, "source": src}
    return {k: obj[k] for k in SCHEMA_KEYS}


def write(name: str, obj: dict) -> None:
    if not safe_name(name):
        raise ValueError(f"unsafe article name: {name!r}")
    fname = f"{name}.json"
    for d in (FRONT_DIR, BACK_DIR):
        d.mkdir(parents=True, exist_ok=True)
        with open(d / fname, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    targets = find_missing_targets()
    print(f"{len(targets)} missing redirect targets: {targets}")
    stats = {"ok": 0, "missing": 0, "error": 0}
    for name in targets:
        try:
            raw = fetch(name)
        except Exception as e:
            print(f"  {name}: fetch failed: {e}")
            continue
        norm = normalize(raw, name)
        write(name, norm)
        stats[norm["status"]] += 1
        print(f"  {name}: {norm['status']} ({len(norm['html'] or '')} chars)")
    print(f"done: {stats}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
