// Generates NOTICE from lib/attribution.ts, the same module the UI renders
// from, so the file and the site can never disagree about what they claim.
//
//   pnpm notice          rewrite NOTICE
//   pnpm notice:check    fail if NOTICE is stale (run in CI)
//
// Requires Node's --experimental-strip-types; lib/attribution.ts is dependency
// free precisely so it can be loaded this way.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const {
    NON_AFFILIATION_NOTICE,
    PROJECT_NAME,
    RIGHTS_CONTACT,
    WIKI_HOST,
    WIKI_LICENSE,
    WIKI_NAME,
    WOTC_NOTICE,
    WOTC_POLICY_URL,
} = await import('../lib/attribution.ts');

const { LICENCE_EXCEPTIONS, PROJECT_LICENCE } = await import('../lib/licence-scope.ts');

// Widest path column, so the table lines up whatever the globs grow into.
const pathWidth = Math.max(...LICENCE_EXCEPTIONS.flatMap((e) => e.paths.map((p) => p.length)));

const scopeTable = LICENCE_EXCEPTIONS.flatMap((e) =>
    e.paths.map((p) => `    ${p.padEnd(pathWidth)}   ${e.spdxId}`),
).join('\n');

const NOTICE = `${PROJECT_NAME}
${'='.repeat(PROJECT_NAME.length)}

This file is generated from lib/attribution.ts and lib/licence-scope.ts by
scripts/gen-notice.mjs. Edit those modules, then run \`pnpm notice\`.

The ${PROJECT_LICENCE} licence in LICENSE covers this repository EXCEPT for the paths
below, each of which is governed by its own terms. Everything not listed here —
the application code, the configs, the docs, the schemas — is ${PROJECT_LICENCE}.

${scopeTable}

REUSE.toml carries the same split in machine-readable form, and LICENSES/ holds
the text of each licence named above.


Article text — ${WIKI_NAME}
--------------------------------------------------------------------------
Place articles are mirrored from https://${WIKI_HOST}/ and are licensed under
${WIKI_LICENSE.label}:

    ${WIKI_LICENSE.url}

Article text on this site remains available under that same licence
(share-alike). Every article view carries an attribution line naming the source
article, linking back to it, and disclosing that the text has been modified: we
strip images, drop the reference apparatus, and truncate appendix sections.

Share-alike travels with the adaptation, not with the directory. Anything built
out of this text carries ${WIKI_LICENSE.label} too, wherever it ends up being stored — a
place index holding article-derived facts, a prebuilt search index over the
prose, precomputed cross-references or backlinks, generated summaries. The
search index is the one that catches people out, because by then it no longer
looks like text. Nothing of that kind is committed today: the indices this
project builds live in memory during the build and are never written out. If one
ever is written out, it belongs on the list above.


Map artwork — Wizards of the Coast
--------------------------------------------------------------------------
${WOTC_NOTICE}

${NON_AFFILIATION_NOTICE}

Use of the underlying Faerûn map artwork is governed by the Fan Content Policy:

    ${WOTC_POLICY_URL}

That policy requires this project to remain free to access. It is permission
rather than a licence, and may be withdrawn at any time.


Tile pyramid, and the images cut from it
--------------------------------------------------------------------------
The tiles served here were cut by this project from the same Wizards of the
Coast map described above. The artwork in them is theirs, and the Fan Content
Policy above is what governs their use. Cutting a pyramid creates no new rights
in the picture, and neither does resizing, cropping or screenshotting it. So the
same terms reach every other copy of the artwork in this repository:

    public/faerun-map.webp       the flat map shown behind the map canvas
    public/faerun-map-card.jpg   the social preview card
    docs/screenshot.webp         the README screenshot

The first two are composited from the pyramid itself by
scripts/gen-map-images.mjs. They are the copies most likely to be hotlinked or
lifted, being ordinary image files at ordinary sizes, which is why they are
named here rather than left to be inferred from where they came from.

How the pyramid was produced is recorded in docs/tile-pipeline.md.


Marker data — origin no longer traceable
--------------------------------------------------------------------------
The marker data in public/data/Faerun/*.json — 297 place names with the pixel
coordinates that locate them on the map — was not compiled by this project. It
came from a forum that went offline years ago; the domain now serves an
unrelated site, and the data has circulated since with no attribution attached
to it. Whoever assembled it cannot be identified from what survives.

This project therefore asserts no claim over it and grants no permission over
it. It is recorded as untraceable rather than quietly folded into the ${PROJECT_LICENCE}
grant, because granting rights this project does not hold would be the worse
error.

If you compiled it, or you know who did, the section below is the way to reach
us.


Rights holders — corrections and removals
--------------------------------------------------------------------------
This project mirrors material it does not own. If you hold rights in something
used here and you want it credited differently, credited where it currently is
not, or removed altogether, please say so and it will be acted on.

Publicly:

    ${RIGHTS_CONTACT.public}

Privately, if you would rather not open a public issue:

    ${RIGHTS_CONTACT.private}

No proof of ownership is demanded up front and no particular form is required —
a plain request is enough to start. Attribution and removal requests are treated
as higher priority than any feature or bug here, because they are obligations
rather than preferences.
`;

const noticePath = path.join(import.meta.dirname, '..', 'NOTICE');
const check = process.argv.includes('--check');

if (check) {
    const current = await readFile(noticePath, 'utf8').catch(() => '');
    if (current !== NOTICE) {
        console.error('NOTICE is out of date with lib/attribution.ts. Run `pnpm notice`.');
        process.exit(1);
    }
    console.log('NOTICE is up to date.');
} else {
    await writeFile(noticePath, NOTICE, 'utf8');
    console.log(`Wrote ${noticePath}`);
}
