// Loads a place's wiki article from the local mirror under
// data/Faerun/wiki/<urlencoded-name>.json. Files conform to
// schemas/wiki-article.schema.json. Runtime never touches the remote wiki.
//
// Resolves to { wrap, meta }. `meta` carries what the CC BY-SA credit line
// needs — the canonical page name to link back to, its display title, and the
// snapshot date — and always describes the article actually rendered, so a
// followed redirect credits the target rather than the stub.

import { escapeHtml, parseHtml } from './dom-util.js';

const WIKI_DIR = 'data/Faerun/wiki';

// In-flight + resolved promise dedup, scoped to this page load.
const memory = new Map();

export function getWiki(pageName) {
    if (memory.has(pageName)) return memory.get(pageName);
    const p = fetchAndClean(pageName);
    memory.set(pageName, p);
    return p;
}

async function fetchAndClean(pageName, depth = 0) {
    const url = `${WIKI_DIR}/${encodeURIComponent(pageName)}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('No archive entry for this place.');

    // A missing file can resolve to the SPA's index.html (HTTP 200) in dev and
    // on some static hosts. Guard against parsing that HTML as JSON.
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) throw new Error('No archive entry for this place.');
    const article = await res.json();

    if (article.status !== 'ok') {
        const err = article.error || {};
        throw new Error(err.info || err.code || article.status);
    }

    // Some markers point at wiki redirect stubs (a renamed/respelled place).
    // Follow the redirect when the canonical article is in our mirror; if it
    // isn't, show a tidy note instead of the raw "Redirect to:" list.
    const target = redirectTarget(article.html);
    if (target && depth < 3) {
        try {
            return await fetchAndClean(target, depth + 1);
        } catch {
            // Target isn't mirrored: credit the live wiki article we're
            // pointing the reader at, not the stub we happen to hold — so the
            // name is the redirect target, overriding the stub's own.
            return {
                wrap: redirectNotice(pageName, target),
                meta: { name: target, title: target, fetchedAt: (article.source || {}).fetchedAt || '' },
            };
        }
    }

    return { wrap: cleanup(article.html), meta: metaFor(article, pageName) };
}

// Attribution facts for one article, defaulting to the requested page name
// when the mirror predates a field.
function metaFor(article, pageName) {
    return {
        name: article.name || pageName,
        title: article.title || article.name || pageName,
        fetchedAt: (article.source || {}).fetchedAt || '',
    };
}

// A redirect stub is just <div class="redirectMsg">…<ul class="redirectText">
// <li><a title="Target">…</a></li></ul></div>. Return the target page name,
// or null for a normal article.
function redirectTarget(html) {
    const probe = parseHtml(html);
    const link = probe.querySelector('.redirectMsg .redirectText a, .redirectMsg a');
    if (!link) return null;
    return (link.getAttribute('title') || link.textContent).trim() || null;
}

function redirectNotice(name, target) {
    const wrap = document.createElement('div');
    const clean = target.replace(/\s*\(disambiguation\)\s*$/i, '');
    const note = document.createElement('div');
    note.className = 'wiki-redirect';
    note.innerHTML =
        `<p>No separate archive entry for <strong>${escapeHtml(name)}</strong>.</p>`
        + `<p class="muted">Recorded in the lore as <strong>${escapeHtml(clean)}</strong>.</p>`;
    wrap.appendChild(note);
    return wrap;
}

/**
 * Strip MediaWiki noise and return a DocumentFragment ready to mount.
 * Mirrors the cleanup the original FantasyMap did, adapted for Fandom's markup.
 */
function cleanup(html) {
    const wrap = parseHtml(html);

    // <a> → bare text (we don't want wiki nav to escape the popup)
    wrap.querySelectorAll('a').forEach((a) => {
        a.replaceWith(document.createTextNode(a.textContent));
    });

    const drop = [
        'nav.toc',
        'sup',
        'sup.reference',
        '.mw-ext-cite-error',
        '.mw-editsection',
        '.mw-empty-elt',
        'h2.pi-title',
        '.references',
        '.reference',
        '.navbox',
        '.toc',
        '.mw-references-wrap',
        '.pi-navigation',        // dead "Gallery" link — no article has images
        '.rightscroll',
        '[typeof="mw:File"]',     // empty image placeholders
        '.dablink',               // top-of-page disambiguation hatnotes
        '.hatnote',
        '.rellink',
        '.mw-disambig',
        'table.stub',             // "this article is a stub" notice boxes
        '.metadata',              // wiki maintenance/metadata message boxes
        '.messagebox',
        '.ambox',
        '.noprint',
        '.featured-article',      // "This is a Featured/Good Article!" badges
        '.good-article',
    ];
    wrap.querySelectorAll(drop.join(',')).forEach((el) => el.remove());

    // The "This is a Good Article!" badge is a plain <p><b>…</b></p> with no
    // stable class — match it by text and drop the whole paragraph.
    wrap.querySelectorAll('p').forEach((p) => {
        if (/Good Article/.test(p.textContent)) p.remove();
    });

    truncateAppendix(wrap);

    // Fandom wraps inline styles that fight our dark theme — strip the
    // most aggressive style attribute that sets a white background.
    wrap.querySelectorAll('[style*="background"], [style*="color"]').forEach((el) => {
        el.removeAttribute('style');
    });

    return wrap;
}

// Wiki location articles end with an "Appendix" section (References, Appearances,
// Gallery, Notes, stub notices, external links) — pure meta with no in-world
// content. Headings are flat <h2><span class="mw-headline"> siblings, so we drop
// the first terminal heading and everything after it. The lead prose and all
// real sections (Geography, History, Government, …) sit before it and survive.
const TERMINAL_HEADINGS = new Set([
    'appendix', 'references', 'see also', 'external links', 'further reading',
    'bibliography', 'appearances', 'gallery', 'image gallery', 'map gallery',
    'connections', 'notes and references', 'notes & references',
]);

function truncateAppendix(wrap) {
    const headings = wrap.querySelectorAll('h2');
    for (const hd of headings) {
        const label = (hd.querySelector('.mw-headline') || hd)
            .textContent.replace(/\[\s*edit\s*\]/i, '').trim().toLowerCase();
        if (!TERMINAL_HEADINGS.has(label)) continue;
        // Remove this heading and every following sibling within its parent.
        let node = hd.nextSibling;
        while (node) {
            const next = node.nextSibling;
            node.remove();
            node = next;
        }
        hd.remove();
        return;
    }
}
