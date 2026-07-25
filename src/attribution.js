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
//      obligation 2 is what governs it too. There is one rights holder in
//      the map: Wizards of the Coast.

// The fan-content title used in the WotC notice. Changing it here changes it
// everywhere except index.html's <title>/brand.
export const PROJECT_NAME = 'Post Map';

export const WIKI_HOST = 'forgottenrealms.fandom.com';
export const WIKI_NAME = 'Forgotten Realms Wiki';

export const WIKI_LICENSE = {
    label: 'CC BY-SA 3.0',
    url: 'https://creativecommons.org/licenses/by-sa/3.0/',
};

export const TILE_SOURCE = {
    label: 'Wizards of the Coast',
    url: 'https://company.wizards.com/en/legal/fancontentpolicy',
};

// Verbatim from https://company.wizards.com/en/legal/fancontentpolicy — do not
// paraphrase; the policy asks for this exact wording.
export const WOTC_NOTICE =
    `${PROJECT_NAME} is unofficial Fan Content permitted under the Fan Content Policy. `
    + 'Not approved/endorsed by Wizards. Portions of the materials used are property of '
    + 'Wizards of the Coast. ©Wizards of the Coast LLC.';

/** Human-facing wiki article URL for a page name (not the api.php endpoint). */
export function articleUrl(pageName) {
    return `https://${WIKI_HOST}/wiki/${encodeURIComponent(String(pageName).replace(/ /g, '_'))}`;
}

/** ISO timestamp → "17 May 2026". Returns '' for missing/unparseable input. */
export function formatSyncDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Per-article credit line, appended to the bottom of every place panel.
 * This is the CC BY-SA attribution — it must render on every article view,
 * not just once site-wide.
 *
 * @param {{ name: string, title?: string, fetchedAt?: string }} meta
 * @returns {Element}
 */
export function buildArticleCredit(meta) {
    const page = meta.title || meta.name;
    const credit = document.createElement('footer');
    credit.className = 'wiki-credit';

    const from = document.createElement('span');
    from.className = 'wiki-credit-line';
    from.append('From ');

    const link = document.createElement('a');
    link.href = articleUrl(meta.name);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = page;
    from.appendChild(link);

    from.append(` on the ${WIKI_NAME}, licensed under `);
    from.appendChild(licenseLink());
    from.append('.');
    credit.appendChild(from);

    // CC BY-SA 3.0 §4(b) requires marking a derivative work as modified. We
    // strip images, drop the reference apparatus, and truncate the appendix
    // sections, so every article we render is a modified version and has to
    // say so.
    const stamp = document.createElement('span');
    stamp.className = 'wiki-credit-stamp';
    const synced = formatSyncDate(meta.fetchedAt);
    stamp.textContent = synced
        ? `Abridged — images and reference sections removed. Archived ${synced}; `
          + 'the live article may have changed.'
        : 'Abridged — images and reference sections removed.';
    credit.appendChild(stamp);

    return credit;
}

function licenseLink() {
    const a = document.createElement('a');
    a.href = WIKI_LICENSE.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer license';
    a.textContent = WIKI_LICENSE.label;
    return a;
}

function extLink(href, label) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    return a;
}

/**
 * Site-wide credits block for the sidebar. Covers the two obligations that are
 * not per-article: the WotC fan-content notice and tile provenance.
 *
 * @param {Element} container  sidebar element
 */
export function buildCreditsSection(container) {
    const wrap = document.createElement('div');
    wrap.className = 'credits';

    const heading = document.createElement('h3');
    heading.textContent = 'Credits & licence';
    wrap.appendChild(heading);

    const lore = document.createElement('p');
    lore.className = 'credit-note';
    lore.append('Place articles come from the ');
    lore.appendChild(extLink(`https://${WIKI_HOST}/`, WIKI_NAME));
    lore.append(', used under ');
    lore.appendChild(licenseLink());
    lore.append('. Article text on this site is available under the same licence.');
    wrap.appendChild(lore);

    const tiles = document.createElement('p');
    tiles.className = 'credit-note';
    tiles.append('Map tiles derived from ');
    tiles.appendChild(extLink(TILE_SOURCE.url, TILE_SOURCE.label));
    tiles.append('.');
    wrap.appendChild(tiles);

    const wotc = document.createElement('p');
    wotc.className = 'credit-note credit-wotc';
    wotc.textContent = WOTC_NOTICE;
    wrap.appendChild(wotc);

    const unaffiliated = document.createElement('p');
    unaffiliated.className = 'credit-note';
    unaffiliated.textContent =
        'This site is not affiliated with, endorsed, sponsored, or specifically '
        + 'approved by Wizards of the Coast LLC.';
    wrap.appendChild(unaffiliated);

    container.appendChild(wrap);
    return wrap;
}
