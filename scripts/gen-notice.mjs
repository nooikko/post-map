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
} = await import('../lib/attribution.ts');

const NOTICE = `${PROJECT_NAME}
${'='.repeat(PROJECT_NAME.length)}

This file is generated from lib/attribution.ts by scripts/gen-notice.mjs.
Edit that module, then run \`pnpm notice\`.

The MIT licence in LICENSE covers this project's own source code. It does NOT
cover the map artwork or the article text, each of which is governed by its own
terms below.


Article text — ${WIKI_NAME}
--------------------------------------------------------------------------
Place articles are mirrored from https://${WIKI_HOST}/ and are licensed under
${WIKI_LICENSE.label}:

    ${WIKI_LICENSE.url}

Article text on this site remains available under that same licence
(share-alike). Every article view carries an attribution line naming the source
article, linking back to it, and disclosing that the text has been modified: we
strip images, drop the reference apparatus, and truncate appendix sections.


Map artwork — Wizards of the Coast
--------------------------------------------------------------------------
${WOTC_NOTICE}

${NON_AFFILIATION_NOTICE}

Use of the underlying Faerûn map artwork is governed by the Fan Content Policy:

    https://company.wizards.com/en/legal/fancontentpolicy

That policy requires this project to remain free to access. It is permission
rather than a licence, and may be withdrawn at any time.


Tile pyramid
--------------------------------------------------------------------------
The tiles served here were cut by this project from the same Wizards of the
Coast map described above. The artwork in them is theirs, and the Fan Content
Policy above is what governs their use.

How the pyramid was produced is recorded in docs/tile-pipeline.md.


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
