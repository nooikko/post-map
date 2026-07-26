# Schemas

JSON Schemas for the data shipped with the app.

| File | Applies to |
| --- | --- |
| `wiki-article.schema.json` | `public/data/Faerun/wiki/*.json` |

One file per place name, keyed by the marker's `name`. Filenames are stored
decoded (`Baldur's Gate.json`, not `Baldur%27s%20Gate.json`).

The envelope is the same shape for `ok`, `missing`, and `error`, so consumers
never branch on the response *form* — only on `status`. 310 files: 292 `ok`,
18 `missing`.

## How the mirror was built

The original scrape ran `fetch → strip-images → normalize`, staging raw
MediaWiki `action=parse` responses before converting them to this schema. Those
scripts have been removed: the raw staging tree was deleted once normalisation
completed, which left all three pointing at paths that no longer exist. The
mirror in `public/data/Faerun/wiki/` is the surviving artefact, and it is a
build input — nothing fetches the wiki at runtime.

`scripts/fetch_redirect_targets.py` is the one live script. Some markers point
at wiki redirect stubs whose real content lives under a renamed title
(Velprintalar → Veltalar). It scans the mirror for those stubs, fetches any
target that is missing, and writes it under the *target* name so the build's
redirect-follow (`lib/wiki/load.ts`) resolves to a full article. It is
idempotent.

```bash
python3 scripts/fetch_redirect_targets.py           # skips targets already present
python3 scripts/fetch_redirect_targets.py --force
```

Requires `beautifulsoup4`.

## Not covered by a schema

The marker GeoJSON in `public/data/Faerun/*.json` has no schema, no stable IDs,
and encodes its category in the *filename*. See the data section of the root
[README](../README.md); a planned phase moves the source of truth into SQLite
and gives it a real one.
