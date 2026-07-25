#!/usr/bin/env python3
"""Static file server with proper cache headers and content negotiation.

- Tiles (immutable assets): Cache-Control: public, max-age=31536000, immutable
- Static libs (js/css/fonts): same — content-hashed paths in future, fine for now
- HTML: no-cache so reloads pick up changes
- JSON / wasm: short cache, must-revalidate
- Brotli-precompressed (.br) variants served when client accepts encoding
"""
import argparse
import gzip
import http.server
import mimetypes
import os
import socketserver
from pathlib import Path

ROOT = Path(__file__).parent.resolve()

# Make sure .webp gets the right content type on all systems
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/manifest+json", ".webmanifest")

# Cache policy by extension
IMMUTABLE_EXTS = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2", ".ttf", ".otf"}
LIB_EXTS       = {".js", ".css"}                   # mid-cache; we don't hash yet
REVAL_EXTS     = {".json", ".geojson"}
NOCACHE_EXTS   = {".html", ".webmanifest"}

def cache_control_for(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in IMMUTABLE_EXTS:
        return "public, max-age=31536000, immutable"
    if ext in LIB_EXTS:
        # Dev server: revalidate every request so file edits land on the
        # next reload without needing cmd-shift-R or "Clear site data".
        return "no-cache"
    if ext in REVAL_EXTS:
        return "public, max-age=300, must-revalidate"
    if ext in NOCACHE_EXTS:
        return "no-cache"
    return "public, max-age=60"


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        # Resolve the path
        path = self.translate_path(self.path)
        p = Path(path)

        # Directory → look for index.html
        if p.is_dir():
            for index in ("index.html", "index.htm"):
                idx = p / index
                if idx.is_file():
                    p = idx
                    path = str(p)
                    break
            else:
                return self.list_directory(str(p))

        if not p.is_file():
            self.send_error(404, "File not found")
            return None

        # Brotli content negotiation: if client accepts br and a .br file exists, serve that
        accept = self.headers.get("Accept-Encoding", "")
        encoding = None
        served = p
        if "br" in accept:
            br = p.with_suffix(p.suffix + ".br")
            if br.is_file():
                served = br
                encoding = "br"
        if not encoding and "gzip" in accept:
            gz = p.with_suffix(p.suffix + ".gz")
            if gz.is_file():
                served = gz
                encoding = "gzip"

        try:
            f = served.open("rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
        fs = served.stat()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(fs.st_size))
        self.send_header("Last-Modified", self.date_time_string(int(fs.st_mtime)))
        self.send_header("Cache-Control", cache_control_for(p))
        if encoding:
            self.send_header("Content-Encoding", encoding)
        # CORS so a Service Worker / module imports work without surprise
        self.send_header("Access-Control-Allow-Origin", "*")
        # Service Worker needs this on its own response for scope detection
        if p.name == "sw.js":
            self.send_header("Service-Worker-Allowed", "/")
        self.end_headers()
        return f

    def log_message(self, fmt, *args):
        # Quieter logs — only show non-200s and HTML/JSON requests
        try:
            status = args[1] if len(args) >= 2 else ""
            req = args[0] if args else ""
            if status.startswith("2") and ".webp" in req:
                return
        except (IndexError, AttributeError):
            pass
        super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-p", "--port", type=int, default=8765)
    ap.add_argument("-b", "--bind", default="127.0.0.1")
    args = ap.parse_args()

    os.chdir(ROOT)
    with socketserver.ThreadingTCPServer((args.bind, args.port), Handler) as httpd:
        httpd.allow_reuse_address = True
        print(f"Serving {ROOT} on http://{args.bind}:{args.port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nshutting down")


if __name__ == "__main__":
    main()
