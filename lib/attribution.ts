// Single source of truth for every attribution/licensing fact the UI shows.
//
// Three obligations are encoded here:
//   1. Forgotten Realms Wiki prose is CC BY-SA 3.0 — requires attribution on
//      every use plus a link back to the source article, and share-alike on
//      derivative works.
//   2. The base map is Wizards of the Coast IP, used under the Fan Content
//      Policy — requires the verbatim unofficial-content notice, and the site
//      must stay free to access.
//   3. The tile pyramid is this project's own cut of that same WotC map, so
//      obligation 2 is what governs it too. There is exactly one rights holder
//      in the map: Wizards of the Coast.
//
// This module is data + pure helpers only. The rendering lives in
// components/place/ArticleCredit.tsx and components/chrome/Credits.tsx so that
// both the intercepted modal and the standalone page share one implementation
// and cannot drift apart — the per-article credit is a licence condition on
// every article view, not a decoration.

export const PROJECT_NAME = 'Post Map';

export const WIKI_HOST = 'forgottenrealms.fandom.com';
export const WIKI_NAME = 'Forgotten Realms Wiki';

export const WIKI_LICENSE = {
    label: 'CC BY-SA 3.0',
    url: 'https://creativecommons.org/licenses/by-sa/3.0/',
} as const;

export const REPO_URL = 'https://github.com/nooikko/post-map';

// Where a rights holder goes to ask for a credit change or a removal. This
// lives here rather than only in .github/ so that it lands in NOTICE — the one
// file that travels with a fork or a redistribution, where the issue templates
// do not. Derived from REPO_URL so moving the repository is a one-line change.
export const RIGHTS_CONTACT = {
    public: `${REPO_URL}/issues/new?template=rights_holder.yml`,
    private: `${REPO_URL}/security/advisories/new`,
} as const;

// Verbatim from https://company.wizards.com/en/legal/fancontentpolicy — do not
// paraphrase; the policy asks for this exact wording.
export const WOTC_NOTICE =
    `${PROJECT_NAME} is unofficial Fan Content permitted under the Fan Content Policy. `
    + 'Not approved/endorsed by Wizards. Portions of the materials used are property of '
    + 'Wizards of the Coast. ©Wizards of the Coast LLC.';

export const NON_AFFILIATION_NOTICE =
    'This site is not affiliated with, endorsed, sponsored, or specifically '
    + 'approved by Wizards of the Coast LLC.';

/** Human-facing wiki article URL for a page name (not the api.php endpoint). */
export function articleUrl(pageName: string): string {
    return `https://${WIKI_HOST}/wiki/${encodeURIComponent(String(pageName).replace(/ /g, '_'))}`;
}

/** ISO timestamp → "17 May 2026". Returns '' for missing/unparseable input. */
function formatSyncDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The modification disclosure required by CC BY-SA 3.0 §4(b). We strip images,
 * drop the reference apparatus, and truncate the appendix sections, so every
 * article we render is a modified version and has to say so.
 */
export function modificationNotice(fetchedAt: string | null | undefined): string {
    const synced = formatSyncDate(fetchedAt);
    return synced
        ? `Abridged — images and reference sections removed. Archived ${synced}; `
          + 'the live article may have changed.'
        : 'Abridged — images and reference sections removed.';
}
