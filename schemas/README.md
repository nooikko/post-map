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

`scripts/fetch-redirect-targets.ts` is the one live script. Some markers point
at wiki redirect stubs whose real content lives under a renamed title
(Velprintalar → Veltalar). It scans the mirror for those stubs, fetches any
target that is missing, and writes it under the *target* name so the build's
redirect-follow (`lib/wiki/load.ts`) resolves to a full article. It is
idempotent.

```bash
pnpm fetch:redirects            # skips targets already present
pnpm fetch:redirects --force    # re-fetch targets already on disk
```

Selectors and the file envelope are shared with the runtime through
`lib/wiki/mirror.ts`, so the script and the reader cannot disagree about what a
redirect stub is.

## Not covered by a schema

The marker GeoJSON in `public/data/Faerun/*.json` has no schema, no stable IDs,
and encodes its category in the *filename*. `lib/markers/load.ts` reads it and
`lib/slug.ts` derives stable URLs from place names, disambiguating the two
name collisions with a numeric suffix. Its origin, and why this project asserts
no claim over it, are in [NOTICE](../NOTICE).
