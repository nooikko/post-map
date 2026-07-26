# Post Map

An interactive map of Faerûn, built to be a better table reference than the war
maps it replaces. Pan and zoom a tiled 3rd-edition Faerûn map, toggle 297
marked places across eight categories, measure distances, and read a mirrored
Forgotten Realms Wiki article for any place without leaving the map.

Not affiliated with Wizards of the Coast. See [NOTICE](NOTICE).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · OpenLayers 10, deployed
static on Vercel. There is no database and no server code: every page is
prerendered at build time and served from the CDN.

## Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

```bash
pnpm build          # prerenders the map + 297 place pages
pnpm start          # serve the production build
pnpm typecheck
pnpm notice         # regenerate NOTICE from lib/attribution.ts
pnpm notice:check   # fail if NOTICE has drifted
```

## How it fits together

```
app/
  page.tsx                    map
  place/[slug]/               standalone place page
  @modal/(.)place/[slug]/     the same place, intercepted over the map
components/{map,place,chrome}
lib/{map,wiki,markers,place,settings}
public/{tiles,data}
```

**The map** is client-only. OpenLayers is imported inside an effect
(`components/map/MapShell.tsx`) so it never loads during server rendering, and
`lib/map/create.ts` builds the projection, tile grid, and source per instance
rather than at module scope.

The projection is a custom pixel CRS — coordinates are raw image pixels against
a 4763 × 3185 source image, not longitude/latitude. `lib/map/geometry.ts` holds
that math with no OpenLayers dependency. Tiles are a z0–z6 pyramid of 512px @2x
WebP over a 256px logical grid.

**Places** get real URLs. Clicking a marker pushes `/place/<slug>`, which the
`@modal` parallel slot intercepts and renders over the still-mounted map;
loading or refreshing that URL directly renders the standalone page instead.
Both render the same `PlacePanel`, so the two views cannot drift apart.

Place pages are `noindex` and disallowed in `robots.txt`. This is a map, not a
mirror of the wiki, and it should not compete with the wiki in search results.

**Article text** is cleaned at build time, not in the browser. `lib/wiki/`
parses each mirrored article with linkedom, strips MediaWiki furniture, splits
the portable-infobox into structured data, and rewrites every internal link to
an absolute `forgottenrealms.fandom.com` URL.

## Data

`public/data/Faerun/` holds eight GeoJSON files (one per category, 297 features)
and 310 mirrored wiki articles conforming to
[`schemas/wiki-article.schema.json`](schemas/README.md). Both are build inputs,
read from disk and passed to the client as props.

The marker data is not yet normalised: category is encoded in the *filename*,
there are no stable IDs, files carry a UTF-8 BOM, and two place names collide
(`Laviguer` appears in two categories; `The Twin Towers` appears twice in
`Temples.json`). Slugs are derived from names and disambiguated with a numeric
suffix, and the build warns on every collision. A planned second phase moves the
source of truth into SQLite to fix this properly.

## Licensing

Three different sets of terms apply and the most restrictive governs:

| | Terms |
|---|---|
| This source code | MIT — see [LICENSE](LICENSE) |
| Article text | CC BY-SA 3.0, credited on every article view |
| Map artwork | Wizards of the Coast, under the Fan Content Policy |
| Tile pyramid | Cut by this project; the artwork in it is WotC's |

The Fan Content Policy requires the site stay free to access — no paywall,
subscription, or gated download — and is revocable permission rather than a
licence.
