// Allowlist sanitizer for the one string in this app that reaches the DOM as
// raw HTML: `PlaceArticle.proseHtml`, rendered through dangerouslySetInnerHTML
// in components/place/PlacePanel.tsx.
//
// cleanArticle (lib/wiki/clean.ts) is a cosmetic scrub — it removes MediaWiki
// furniture and is not a security boundary. This module is the boundary. It is
// an allowlist, not a denylist: anything not named here does not survive, so a
// tag or attribute nobody anticipated fails closed.
//
// Runs at build time only (all 599 pages are prerendered), over the linkedom
// tree cleanArticle already produced — no reparse, no runtime cost, no
// dependency beyond the linkedom already in the graph.
//
// The mirror in public/data/ is currently free of active HTML, so today this is
// belt-and-braces. It stops being belt-and-braces the moment
// scripts/fetch-redirect-targets.ts pulls a fresh article: that HTML is
// server-rendered into the page, so an injected <script> would execute on load.
//
// Note this operates by mutation. The DOM is the exception to the project's
// immutability rule — cleanArticle and splitArticle already mutate the same
// tree, and copying a parsed document per pass would buy nothing.

/**
 * Elements deleted along with everything inside them. For these the subtree IS
 * the payload, so unwrapping to keep the text would defeat the point.
 */
const DROP_WITH_SUBTREE = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
    'form', 'input', 'button', 'select', 'textarea', 'option', 'label',
    'svg', 'math', 'template', 'noscript', 'applet', 'portal',
    'frame', 'frameset', 'audio', 'video', 'source', 'track', 'canvas',
    'img', 'picture', 'map', 'area', 'figure',
]);

/** Everything wiki prose legitimately needs. */
const ALLOWED_ELEMENTS = new Set([
    'p', 'br', 'hr', 'div', 'span',
    'b', 'i', 'em', 'strong', 'u', 's', 'small', 'code', 'pre', 'abbr', 'cite', 'q',
    'a',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
]);

/**
 * Attributes kept, by tag. `class` is allowed everywhere: it cannot execute,
 * and dropping it would restyle wiki tables for no security gain.
 *
 * Everything absent here goes — notably every `style` (a CSS-injection surface
 * that CSP cannot help with, since style-src-attr must stay 'unsafe-inline'
 * for React's own style props), every `data-*` (Fandom ships base64 payloads
 * in data-uncrawlable-url), every `on*` handler, and `id`.
 */
const GLOBAL_ATTRS = new Set(['class']);

const TAG_ATTRS: Record<string, ReadonlySet<string>> = {
    a: new Set(['href', 'target', 'rel']),
    td: new Set(['colspan', 'rowspan']),
    th: new Set(['colspan', 'rowspan']),
    ol: new Set(['start']),
};

const COMMENT_NODE = 8;

/**
 * Sanitize in place, then serialize. The only supported way to turn a cleaned
 * article tree into a prose string — lib/wiki/infobox.ts calls this instead of
 * reading `root.innerHTML`, so no code path can emit unsanitized HTML.
 */
export function serializeProse(root: Element): string {
    sanitizeTree(root);
    return root.innerHTML;
}

/** Apply the allowlist to `root`'s subtree. Exported for tests and audits. */
export function sanitizeTree(root: Element): void {
    dropComments(root);

    // Document order, so a parent is decided before its children. Removing a
    // parent detaches its descendants; unwrapping promotes them, and because
    // they come later in the snapshot they still get their own turn.
    for (const el of Array.from(root.querySelectorAll('*'))) {
        if (!isInside(el, root)) continue; // an ancestor was already dropped

        const tag = el.tagName.toLowerCase();

        if (DROP_WITH_SUBTREE.has(tag)) {
            el.remove();
            continue;
        }

        if (!ALLOWED_ELEMENTS.has(tag)) {
            unwrap(el);
            continue;
        }

        pruneAttributes(el, tag);

        // A link we cannot vouch for keeps its words and loses its href.
        if (tag === 'a' && !isSafeHref(el.getAttribute('href'))) unwrap(el);
    }
}

function pruneAttributes(el: Element, tag: string): void {
    const allowed = TAG_ATTRS[tag];
    for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (GLOBAL_ATTRS.has(name) || allowed?.has(name)) continue;
        el.removeAttribute(attr.name);
    }
}

/**
 * Only absolute http(s). rewriteLinks has already absolutised everything it
 * intends to keep, so anything still relative — or carrying a javascript:,
 * data:, or vbscript: scheme — is not a destination we put a reader in front of.
 */
function isSafeHref(href: string | null): boolean {
    if (!href) return false;
    try {
        const { protocol } = new URL(href);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

/** Replace an element with its children. */
function unwrap(el: Element): void {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
}

function dropComments(node: Node): void {
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === COMMENT_NODE) child.remove();
        else dropComments(child);
    }
}

/** Walk up to `root`; false once an ancestor has been detached from it. */
function isInside(node: Node, root: Element): boolean {
    let current: Node | null = node;
    while (current) {
        if (current === root) return true;
        current = current.parentNode;
    }
    return false;
}
