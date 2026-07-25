// Small DOM helpers shared by the wiki modules.

/**
 * Escape a string for interpolation into an HTML template.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Parse raw HTML inertly — DOMParser documents have no browsing context, so
 * nothing executes and no subresources load during parsing. Returns a
 * detached <div> holding the parsed nodes, ready to clean up before mounting.
 * @param {string} html
 * @returns {HTMLDivElement}
 */
export function parseHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const wrap = document.createElement('div');
    wrap.append(...doc.body.childNodes);
    return wrap;
}
