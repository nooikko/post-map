# Architecture

How Post Map is put together, for anyone reading or changing the code.

## A note on "the Vite app"

Comments through `lib/` and `components/` refer to *the Vite app*. That is this
project's first implementation: a static Vite + vanilla-JS build (`src/*.js`, a
service worker, a Python tile and wiki toolchain) that this Next.js version
replaced wholesale. It is not in the tree — only in git history, before the
port.

Those references are kept because they carry the reason a thing is shaped the
way it is: a bug that version had, a cost it paid, a behaviour worth matching.
`lib/settings/units.ts` explaining that units shipped half-built, or
`useMarkerInteractions.ts` noting that hit-testing ran twice a frame, is the
record of why the current code does not. Read them as "the previous
implementation", not as a module you can go and open.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · OpenLayers 10, deployed on
Vercel. There is no database and no server code. Every page is prerendered at
build time — 599 routes — and served from the CDN; the GeoJSON and article JSON
under `public/data/` are build inputs read from disk, not runtime API calls.

```
app/
  page.tsx                    map
  place/[slug]/               standalone place page
  @modal/(.)place/[slug]/     the same place, intercepted over the map
  robots.ts
components/
  map/                        MapShell, measure tool, marker interactions
  place/                      PlacePanel, InfoboxRail, ArticleCredit
  chrome/                     Topbar, search, layer toggles, credits
lib/
  map/                        projection, tile grid, geometry, styles
  wiki/                       load -> clean -> sanitize -> infobox
  markers/  place/  settings/
public/
  tiles/                      z0-z6 WebP pyramid (1296 tiles)
  data/Faerun/                8 GeoJSON categories + 310 mirrored articles
scripts/                      build-time tooling (see below)
```

## The map

Client-only. OpenLayers is imported inside an effect in
`components/map/MapShell.tsx` so it never loads during server rendering, and
`lib/map/create.ts` builds the projection, tile grid, and source per instance
rather than at module scope — two maps on one page would otherwise share
mutable state.

The projection is a **custom pixel CRS**: coordinates are raw image pixels
against a 4763 × 3185 source image, not longitude/latitude. `lib/map/geometry.ts`
holds that math with no OpenLayers dependency, so it is testable and reusable in
isolation. `lib/map/config.ts` pins everything tied to the specific pyramid —
image dimensions, zoom range, per-zoom tile bounds, and `METERS_PER_PIXEL`
(1287.473), the scale the distance tool measures against. Changing any of it
means regenerating tiles.

Tiles are a z0–z6 pyramid of 512px @2x WebP over a 256px logical grid, served
from `/tiles/{z}/{x}/{y}.webp` with a one-year immutable cache. They are
committed rather than generated at build time; see
[`tile-pipeline.md`](tile-pipeline.md).

## Routing

Places get real URLs. Clicking a marker pushes `/place/<slug>`, which the
`@modal` parallel slot intercepts and renders over the still-mounted map —
the map keeps its viewport and does not remount. Loading or refreshing that
URL directly renders the standalone page instead.

Both render the same `PlacePanel` component, deliberately: the modal and the
standalone page cannot drift apart, and the per-article licence credit cannot
end up on one but not the other.

Place pages are `noindex` and disallowed in `robots.txt` (`app/robots.ts` and
`lib/place/get.ts`). This is intentional — the site should not compete with the
Forgotten Realms Wiki in search results for the wiki's own text.

### Slugs

Marker names are free text and not unique. `lib/slug.ts` folds diacritics and
strips apostrophes for readable URLs (`Khôltar` → `kholtar`), then
`resolveSlugs` disambiguates collisions with a numeric suffix. Slug stability
depends on input order, so callers must pass markers in a deterministic order —
`lib/markers/load.ts` sorts by layer render order, then by position in the
source file. The build warns on every collision.

## The wiki pipeline

Article HTML is processed at build time, not in the browser. The chain, in
`lib/wiki/`:

| Step | Module | Does |
|---|---|---|
| `readArticleFile` | `load.ts` | Read `public/data/Faerun/wiki/<name>.json` |
| `redirectTarget` | `load.ts` | Follow wiki redirect stubs (max depth 3) |
| `parseFragment` | `clean.ts` | Parse into a detached linkedom tree |
| `cleanArticle` | `clean.ts` | Strip MediaWiki furniture, truncate appendices, absolutise links |
| `splitArticle` | `infobox.ts` | Split the portable-infobox into structured data |
| `serializeProse` | `sanitize.ts` | Apply the allowlist, then serialize |

Two properties matter when changing any of it:

**`clean.ts` is cosmetic; `sanitize.ts` is the security boundary.** `cleanArticle`
removes wiki noise and is not a security control. The allowlist in
`sanitize.ts` is — elements and attributes not named there do not survive, so
anything unanticipated fails closed. It drops every `style`, every `data-*`,
everything executable, and unwraps any anchor whose `href` is not absolute
http(s).

**Sanitizing happens last, at serialization.** It cannot move earlier: the
infobox `<aside>` must still be intact when `parseInfobox` reads it, and an
allowlist applied before that would delete the infobox before it was parsed.
`serializeProse` is the only supported way to turn an article tree into a
string, so no code path can emit unsanitized HTML.

The infobox half needs no sanitizing — `parseInfobox` reads everything through
`normalizedText()` and returns plain strings that React escapes.

## Security

`next.config.ts` sets a Content-Security-Policy plus `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy` on every route.

The CSP has one deliberate compromise. Pages are statically prerendered with no
middleware, so Next cannot mint a per-request nonce and ships its bootstrap as
inline `<script>` elements — `script-src-elem` must therefore allow
`'unsafe-inline'`. The compensating control is `script-src-attr 'none'`, which
blocks every inline `on*` handler. So the sanitizer is the real defence against
injected markup and the CSP is the backstop, not the reverse. `style-src-attr`
stays `'unsafe-inline'` because React writes style props as attributes, which
cannot carry a nonce.

Development relaxes three directives and drops `upgrade-insecure-requests`.
Next's dev overlay injects its stylesheet into a shadow root at runtime, so
`style-src-elem` needs `'unsafe-inline'` or the overlay renders as unstyled
text; Turbopack's HMR evaluates module code and talks over a WebSocket, so
`script-src-elem` needs `'unsafe-eval'` and `connect-src` needs `ws:`.
Everything else is identical across both, so development still exercises the
parts of the policy that can catch a real mistake.

## Scripts

Both run on `node --experimental-strip-types`.

| Script | Purpose |
|---|---|
| `scripts/gen-notice.mjs` | Generate `NOTICE` from `lib/attribution.ts` |
| `scripts/fetch-redirect-targets.ts` | Top up the wiki mirror with redirect targets |

Node does not resolve the `@/` path alias, so anything a script imports must be
dependency-free. That is why `lib/attribution.ts` and `lib/wiki/mirror.ts`
import nothing — keep it that way or the scripts stop running.

`lib/wiki/mirror.ts` holds what the mirror's reader and writer must agree on
(the redirect selector, image-drop lists, the file envelope). If the fetch
script's idea of a redirect stub ever diverges from `load.ts`'s, the script
fetches targets the runtime will never follow.

## Attribution

`lib/attribution.ts` is the single source of truth for every licensing fact the
UI shows, and `NOTICE` is generated from it — `pnpm notice:check` fails if the
two have drifted. The per-article CC BY-SA credit renders from
`components/place/ArticleCredit.tsx` on every article view; the WotC fan-content
notice renders from `components/chrome/Credits.tsx`. Both are licence
conditions, not decoration.
