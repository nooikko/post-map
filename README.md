# Post Map

An interactive map of Faerûn for tabletop D&D — pan and zoom a tiled
3rd-edition map, find any of 297 marked places, measure travel distances, and
read that place's Forgotten Realms Wiki article without leaving the map.

[![CI](https://github.com/nooikko/post-map/actions/workflows/ci.yml/badge.svg)](https://github.com/nooikko/post-map/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Fan Content](https://img.shields.io/badge/Wizards-Fan%20Content%20Policy-orange.svg)](https://company.wizards.com/en/legal/fancontentpolicy)

Not affiliated with, endorsed, or approved by Wizards of the Coast.

![The whole of Faerûn, with all 297 places marked and the category layers, search, and licence notices in the sidebar](docs/screenshot.webp)

## Features

- **The whole of Faerûn**, tiled — smooth pan and zoom, no external tile service.
- **297 places** across eight categories — Capitals, Cities, Ports, Port
  Capitals, Fortresses, Ruins, Sites, and Temples — each toggleable.
- **Place articles** from the Forgotten Realms Wiki, in a panel beside the map,
  with the infobox laid out as readable fields rather than wiki table markup.
- **Distance measurement** in miles or kilometres, scaled from the source map.
- **Search** across every marked place.
- **Shareable links** — every place has its own URL.
- **Works offline-ish** — no database, no accounts, no cookies, and no runtime
  API calls beyond anonymous visitor counts. See [Privacy](PRIVACY.md).

## Getting started

Requires **Node.js 22.6+** and **pnpm**.

```bash
git clone https://github.com/nooikko/post-map.git
cd post-map
pnpm install
pnpm dev
```

Then open http://localhost:3000.

To build and serve the production site:

```bash
pnpm build
pnpm start
```

<details>
<summary>All available scripts</summary>

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Prerender the map and all 297 place pages |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm notice` | Regenerate `NOTICE` from `lib/attribution.ts` |
| `pnpm notice:check` | Fail if `NOTICE` has drifted |
| `pnpm fetch:redirects` | Top up the wiki mirror; `--force` re-fetches |

</details>

## Documentation

- [Architecture](docs/architecture.md) — how the map, routing, and wiki pipeline
  fit together
- [Tile pipeline](docs/tile-pipeline.md) — how the map tiles were produced
- [Data schema](schemas/README.md) — the mirrored article format

## Contributing

Bug reports and ideas are welcome — please
[open an issue](../../issues). This is a personal project, so pull requests may
not be merged; see [CONTRIBUTING.md](CONTRIBUTING.md) before starting work on
one, and [the code of conduct](.github/CODE_OF_CONDUCT.md) for the short version
of how to behave.

To report a security issue, see [SECURITY.md](SECURITY.md) — please use private
reporting rather than a public issue.

## Privacy

The site counts visitors and page-load timings with Vercel Web Analytics and
Speed Insights, on their free tier. No cookies, no accounts, no third-party
trackers, and nothing typed into the search box leaves the browser. The full
policy is at [post-map.vercel.app/privacy](https://post-map.vercel.app/privacy);
see [PRIVACY.md](PRIVACY.md).

## Licensing

Three different sets of terms apply, and the most restrictive governs:

| | Terms |
|---|---|
| This source code | MIT — see [LICENSE](LICENSE) |
| Article text | CC BY-SA 3.0, credited on every article view |
| Map artwork | Wizards of the Coast, under the Fan Content Policy |
| Tile pyramid | Cut by this project; the artwork in it is WotC's |

The Fan Content Policy governs the map and requires that the site stay free to
access — no paywall, subscription, or gated download. It is revocable permission
rather than a licence and can be withdrawn at any time. If you fork this, that
applies to you too.

### If you hold rights in something used here

This project mirrors material it does not own. If you want something credited
differently, credited where it currently is not, or removed altogether, please
open a [rights holder request](../../issues/new?template=rights_holder.yml), or
send it [privately](../../security/advisories/new) if you would rather not file
a public issue.

No proof of ownership is demanded up front and no particular form is required.
These requests are treated as higher priority than any feature or bug here,
because they are obligations rather than preferences.

## Credits

Place articles come from the [Forgotten Realms Wiki](https://forgottenrealms.fandom.com/),
used under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

The map tiles are this project's own cut of the published Faerûn map. The artwork
in them is Wizards of the Coast's — see [docs/tile-pipeline.md](docs/tile-pipeline.md)
for how the pyramid was produced.

Full attributions are in [NOTICE](NOTICE).
