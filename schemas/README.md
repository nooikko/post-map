# Schemas

Common JSON Schemas for data shipped with the app.

| File | Applies to | Notes |
| --- | --- | --- |
| `wiki-article.schema.json` | `data/Faerun/wiki/*.json` and `backend/Faerun/wiki/*.json` | One file per marker name. Same shape for ok / missing / error so the frontend never branches on response form. |

## Pipeline

1. `scripts/fetch_wiki.py` downloads raw MediaWiki `action=parse` responses to `backend/Faerun/wiki-raw/` (preserves provenance verbatim).
2. `scripts/strip_wiki_images.py` removes image-bearing markup from the raw files.
3. `scripts/normalize_wiki.py` converts each raw file into the common schema and writes the result to **both** `backend/Faerun/wiki/` (canonical store) and `data/Faerun/wiki/` (browser-served copy).

The frontend (`src/wiki.js`) reads only `data/Faerun/wiki/<encodeURIComponent(name)>.json` and consumes the fields defined by the schema.
