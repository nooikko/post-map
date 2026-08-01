// Which parts of this repository the MIT licence does NOT cover, and what
// governs them instead.
//
// The scope is written as an EXCLUSION list, not an allowlist. MIT covers the
// whole repository except the paths below, so a new directory defaults to
// permissive instead of falling into an all-rights-reserved hole — the root
// configs, docs/, and schemas/ were all sitting in exactly that hole while the
// scope note in LICENSE enumerated only app/, components/, lib/, and scripts/.
//
// Kept out of lib/attribution.ts on purpose: that module is imported by client
// components (components/chrome/Credits.tsx, components/place/ArticleCredit.tsx)
// and these path globs have no business anywhere near the browser bundle.
// Nothing under app/ or components/ imports this file — only the two generators
// in scripts/, which is why it is dependency free and data only.
//
// Consumers:
//   scripts/gen-notice.mjs  → the summary table in NOTICE
//   scripts/gen-reuse.mjs   → REUSE.toml and the LicenseRef texts in LICENSES/

export const PROJECT_COPYRIGHT = 'Copyright (c) 2026 Quinn Penney';

/** SPDX id for everything not matched by an exception below. */
export const PROJECT_LICENCE = 'MIT';

export interface LicenceException {
    /** Globs relative to the repository root, in REUSE.toml `path` form. */
    paths: readonly string[];
    /** SPDX License Expression. Every LicenseRef-* has a text in LICENSES/. */
    spdxId: string;
    /**
     * SPDX-FileCopyrightText value. REUSE permits the literal 'NOASSERTION'
     * where the holder genuinely cannot be identified; it does NOT permit it as
     * a licence identifier, which is why unknown-origin material still needs a
     * LicenseRef on the licence side.
     */
    copyright: string;
    /** Short label for the summary table in NOTICE. */
    label: string;
}

export const LICENCE_EXCEPTIONS: readonly LicenceException[] = [
    {
        // Every one of these is the same picture at a different size. The two
        // public/faerun-map* files are composited straight out of the pyramid
        // by scripts/gen-map-images.mjs, so they carry exactly what the tiles
        // carry — and being the flattest, most hotlinkable copies of the
        // artwork in the tree, they are the ones an exclusion list must not
        // miss.
        paths: [
            'public/tiles/**',
            'public/faerun-map.webp',
            'public/faerun-map-card.jpg',
            'docs/screenshot.webp',
        ],
        spdxId: 'LicenseRef-WotC-Fan-Content',
        copyright: 'Copyright (c) Wizards of the Coast LLC',
        label: 'Map artwork, and the tiles, flat images and screenshot cut from it',
    },
    {
        paths: ['public/data/Faerun/wiki/**'],
        spdxId: 'CC-BY-SA-3.0',
        copyright: 'Copyright (c) Forgotten Realms Wiki contributors',
        label: 'Mirrored article text, and anything derived from it',
    },
    {
        paths: ['public/data/Faerun/*.json'],
        // Not `LicenseRef-Unknown-*`: the SPDX expression parser reuse uses
        // treats the capitalised token `Unknown` as reserved and rejects the
        // whole identifier. Verified against reuse 6.2.0.
        spdxId: 'LicenseRef-Untraceable-Origin',
        copyright: 'NOASSERTION',
        label: 'Marker data, origin no longer traceable',
    },
];
