// Build-time MediaWiki scrub, done once per article rather than in the browser
// on every popup — that keeps ~400 lines of DOM work and the DOMParser
// dependency off the client.
//
// linkedom gives a real DOM API under Node, so the selector-and-mutate logic
// ports across essentially unchanged.

import { parseHTML } from 'linkedom';

import { articleUrl } from '@/lib/attribution';

/**
 * Namespaced wiki pages that aren't readable articles — links to these are
 * unwrapped. Includes Fandom's project namespace, which on this wiki is the
 * wiki's own name ("Forgotten Realms Wiki:Good articles").
 */
const NON_ARTICLE_NAMESPACES =
    /^(Special|File|Image|Category|Template|Help|User|Talk|Forum|Module|MediaWiki|Project|Blog|Board|Thread|Forgotten Realms Wiki)( talk)?:/i;

const DROP_SELECTORS = [
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
    '.pi-navigation', // dead "Gallery" link — no article has images
    '.rightscroll',
    '[typeof="mw:File"]', // empty image placeholders
    '.dablink', // top-of-page disambiguation hatnotes
    '.hatnote',
    '.rellink',
    // This class also marks ordinary inline article links. Removing those
    // anchors deletes their words (and can empty an entire infobox field).
    '.mw-disambig:not(a)',
    'table.stub', // "this article is a stub" notice boxes
    '.metadata', // wiki maintenance/metadata message boxes
    '.messagebox',
    '.ambox',
    '.noprint',
    '.featured-article', // "This is a Featured/Good Article!" badges
    '.good-article',
];

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

export interface ParsedRoot {
    document: Document;
    root: Element;
}

/** Parse an HTML fragment into a detached container element. */
export function parseFragment(html: string): ParsedRoot {
    const { document } = parseHTML(`<!doctype html><body><div id="root">${html}</div></body>`);
    const root = document.getElementById('root') as unknown as Element;
    return { document: document as unknown as Document, root };
}

/**
 * Strip MediaWiki noise in place and rewrite every surviving link.
 *
 * Link handling is a licence obligation, not cosmetics: CC BY-SA attribution
 * requires the relative `/wiki/Foo` hrefs to become absolute backlinks to
 * forgottenrealms.fandom.com, and poor backlinking is the specific thing the
 * wiki has objected to in mirrors. Zero relative /wiki/ hrefs may survive this
 * function, and unwrapping anchors to bare text does not count as handling
 * them.
 */
export function cleanArticle(root: Element, document: Document): void {
    root.querySelectorAll(DROP_SELECTORS.join(',')).forEach((el) => { el.remove(); });

    // The "This is a Good Article!" badge is a plain <p><b>…</b></p> with no
    // stable class — match it by text and drop the whole paragraph.
    root.querySelectorAll('p').forEach((p) => {
        if (/Good Article/.test(p.textContent ?? '')) p.remove();
    });

    truncateAppendix(root);

    // Deliberately after the removals: a long article carries well over a
    // thousand anchors, most of them citation backrefs inside <sup> and links
    // in the appendix we just deleted. Rewriting only the survivors is both
    // cheaper and avoids touching markup that no longer exists.
    rewriteLinks(root, document);

    // Fandom's inline styles fight our dark theme, but nothing is stripped
    // here: lib/wiki/sanitize.ts drops every style attribute (and every other
    // non-allowlisted one) on its way out. This function is cosmetic; that one
    // is the security boundary.
}

function rewriteLinks(root: Element, document: Document): void {
    root.querySelectorAll('a').forEach((a) => {
        const href = a.getAttribute('href') ?? '';
        const resolved = resolveHref(href);

        if (resolved === null) {
            // Not a followable destination (dead red link, removed-section
            // anchor, non-article namespace) — keep the words, drop the link.
            a.replaceWith(document.createTextNode(a.textContent ?? ''));
            return;
        }

        a.setAttribute('href', resolved);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        // Fandom marks internal links with classes that carry its own styling.
        a.removeAttribute('class');
        a.removeAttribute('title');
        a.removeAttribute('data-uncrawlable-link');
    });
}

/**
 * Map a MediaWiki href to an absolute URL, or null when the link should be
 * unwrapped to plain text.
 */
function resolveHref(href: string): string | null {
    if (!href) return null;

    // Anchors point into sections we may have removed.
    if (href.startsWith('#')) return null;

    if (href.startsWith('//')) return `https:${href}`;
    if (/^https?:\/\//i.test(href)) return href;

    if (href.startsWith('/wiki/')) {
        const [rawPath, query = ''] = href.slice('/wiki/'.length).split('?', 2);
        // redlink=1 means the target article does not exist.
        if (/(^|&)redlink=1(&|$)/.test(query)) return null;

        let pageName: string;
        try {
            pageName = decodeURIComponent(rawPath);
        } catch {
            pageName = rawPath; // malformed percent-encoding: use as-is
        }
        pageName = pageName.replace(/_/g, ' ').trim();
        if (!pageName) return null;
        if (NON_ARTICLE_NAMESPACES.test(pageName)) return null;

        return articleUrl(pageName);
    }

    // Relative paths we don't recognise would resolve against our own domain.
    return null;
}

function truncateAppendix(root: Element): void {
    const headings = root.querySelectorAll('h2');
    for (const hd of headings) {
        const labelSource = hd.querySelector('.mw-headline') ?? hd;
        const label = (labelSource.textContent ?? '')
            .replace(/\[\s*edit\s*\]/i, '')
            .trim()
            .toLowerCase();
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

/** Collapse whitespace in an element's text. */
export function normalizedText(el: Element | null | undefined): string {
    return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
}
