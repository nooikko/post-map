# Schemas

JSON Schemas for the data shipped with the app.

| File | Applies to |
| --- | --- |
| `wiki-article.schema.json` | `public/data/Faerun/wiki/*.json` |

One file per place name, keyed by the marker's `name`. Filenames are stored
decoded (`Baldur's Gate.json`, not `Baldur%27s%20Gate.json`).

The envelope is the same shape for `ok`, `missing`, and `error`, so consumers
never branch on the response *form* — only on `status`.

## Refreshing the mirror

`pnpm wiki:sync` fetches the current wiki content for existing mirror entries
and map markers, follows redirect targets, strips images, and writes the JSON
directly to `public/data/Faerun/wiki/`. Wiki responses are the source of truth,
including changed text and missing pages. Nothing fetches the wiki at runtime.

`lib/wiki/article-names.ts` maps historical map labels to wiki page titles.
The marker names and filenames stay unchanged.

```bash
pnpm wiki:sync
pnpm fetch:redirects            # fetch absent redirect targets
pnpm fetch:redirects --force    # refresh targets already on disk
```

The `html` field is image-stripped source. The build cleans it, extracts the
infobox, and runs the allowlist sanitizer before rendering it.

## Not covered by a schema

The marker GeoJSON in `public/data/Faerun/*.json` has no schema, no stable IDs,
and encodes its category in the *filename*. `lib/markers/load.ts` reads it and
`lib/slug.ts` derives stable URLs from place names, disambiguating the two
name collisions with a numeric suffix. Its origin, and why this project asserts
no claim over it, are in [NOTICE](../NOTICE).
