# Contributing

Thanks for looking. Please read this before spending time on a change.

## What this project is

Post Map is a personal project, built for one gaming table. Bug reports and
ideas are genuinely welcome. **Pull requests may not be merged** — not because
they aren't appreciated, but because the scope is deliberately small and I may
already be part-way through something that conflicts.

So: open an issue first. If we agree on the shape of a change, a PR is much more
likely to land.

There is also a licensing constraint worth knowing about before you invest
effort. The map artwork is Wizards of the Coast's, used under their
[Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy),
which is revocable permission rather than a licence. This project may have to
change significantly or disappear entirely at short notice, through nobody's
fault.

## Good things to open an issue about

- A place is missing, mislabelled, or in the wrong position on the map
- An article renders badly — broken layout, missing content, mangled infobox
- Anything wrong with the attribution or licence notices; these are obligations,
  so mistakes in them matter more than cosmetic bugs
- Performance problems, especially on mobile

For anything security-related, use [SECURITY.md](SECURITY.md) instead of a
public issue.

## Setting up

Requires Node.js 22.6+ and pnpm.

```bash
pnpm install
pnpm dev
```

## Before you open a PR

```bash
pnpm typecheck      # must pass
pnpm build          # must pass; prerenders all 599 routes
pnpm notice:check   # must pass if you touched lib/attribution.ts
```

There is no test suite. Verification is the build plus checking the actual
pages, so say in the PR what you loaded and what you saw.

If you changed the wiki pipeline (`lib/wiki/`), confirm you did not break the
sanitizer: inject `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>`
into one file in `public/data/Faerun/wiki/`, rebuild, confirm neither survives
into `.next/server/app/place/<slug>.html`, then revert the file.

## Conventions

Commit messages are `<type>: <description>`, lowercase, imperative:

```
feat: add a scale bar to the measure tool
fix: stop the modal stealing focus on Escape
docs: explain the tile pyramid's provenance
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Code style, briefly:

- Prefer new objects over mutating existing ones. The linkedom tree in
  `lib/wiki/` is the deliberate exception, and it is documented as such.
- Many small files over few large ones — 200–400 lines is typical, 800 is the
  ceiling. Organise by feature, not by file type.
- Explain *why* in comments, not *what*. The existing comments are the model.

[docs/architecture.md](docs/architecture.md) explains how the pieces fit
together and which invariants matter. Worth reading before changing `lib/wiki/`
or `lib/map/`.
