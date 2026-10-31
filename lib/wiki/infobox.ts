// Parses Fandom's "portable-infobox" markup into structured data so React can
// render it, instead of shipping Fandom's table markup to the browser.
//
//   aside.portable-infobox
//     section.pi-group
//       h2.pi-header                -> group heading (Geography, Society, …)
//       div.pi-data[data-source]
//         h3.pi-data-label          -> field label
//         div.pi-data-value         -> field value (may hold a table/<br> list)
//   div.pi-data may also sit directly under the aside (ungrouped).

import { normalizedText } from '@/lib/wiki/clean';
import { serializeProse } from '@/lib/wiki/sanitize';
import type { InfoboxBar, InfoboxField, InfoboxGroup, InfoboxPart } from '@/lib/wiki/types';

export interface SplitArticle {
    proseHtml: string;
    groups: InfoboxGroup[];
    epithet: string | null;
}

/**
 * Split a cleaned article into prose and infobox data. Mutates `root` by
 * removing the infobox aside — callers pass a root they own.
 *
 * The infobox half needs no sanitizing: parseInfobox reads everything through
 * normalizedText() and returns plain strings that React escapes. Only the prose
 * half becomes raw HTML, and serializeProse is what makes it safe to.
 *
 * Sanitizing happens here rather than in cleanArticle because the aside must
 * still be intact when parseInfobox runs — an allowlist applied any earlier
 * would delete the infobox before it was read.
 */
export function splitArticle(root: Element): SplitArticle {
    const aside = root.querySelector('aside.portable-infobox');
    const groups = aside ? parseInfobox(aside) : [];
    if (aside) aside.remove();

    tidyProse(root);

    return {
        proseHtml: serializeProse(root),
        groups,
        epithet: primaryAlias(groups),
    };
}

/**
 * The place's primary alias, promoted into the panel subtitle. The full alias
 * set still renders in the rail, so only the first is used here — joining all
 * of them duplicates the rail and overflows for places like Silverymoon that
 * carry a dozen nicknames.
 */
function primaryAlias(groups: InfoboxGroup[]): string | null {
    for (const group of groups) {
        for (const field of group.fields) {
            if (field.kind === 'chips' && field.source === 'aliases' && field.chips.length > 0) {
                return field.chips[0];
            }
        }
    }
    return null;
}

function parseInfobox(aside: Element): InfoboxGroup[] {
    const groups: InfoboxGroup[] = [];

    // Ungrouped fields that appear before/outside any section get their own
    // bucket so nothing is silently dropped.
    let loose: InfoboxGroup | null = null;

    for (const child of Array.from(aside.children)) {
        if (child.matches('section.pi-group')) {
            const heading = normalizedText(child.querySelector('.pi-header'));
            const fields = directChildren(child, '.pi-data')
                .map(parseField)
                .filter((f): f is InfoboxField => f !== null);
            if (fields.length > 0) groups.push({ heading: heading || null, fields });
        } else if (child.matches('.pi-data')) {
            const field = parseField(child);
            if (field) {
                if (!loose) {
                    loose = { heading: null, fields: [] };
                    groups.push(loose);
                }
                loose.fields.push(field);
            }
        }
    }

    return groups;
}

// `:scope >` is unreliable across DOM shims, so filter children directly.
function directChildren(el: Element, selector: string): Element[] {
    return Array.from(el.children).filter((c) => c.matches(selector));
}

function parseField(el: Element): InfoboxField | null {
    const source = el.getAttribute('data-source') ?? '';
    const label = normalizedText(el.querySelector('.pi-data-label')) || titleCase(source);
    const value = el.querySelector('.pi-data-value');
    if (!value) return null;

    if (value.querySelector('table.percentagetable')) {
        const parts = distributionParts(value);
        if (parts.some((part) => part.kind === 'bars')) return { kind: 'bars', label, source, parts };
    }

    // --- aliases / spelling -> chips (split on <br> OR commas; some pages
    //     list each alias on its own line, others comma-separate them) ---
    if (source === 'aliases' || source === 'alt spelling') {
        const raw = value.querySelector('br')
            ? splitByBr(value)
            : normalizedText(value).split(',');
        const chips = raw.map((s) => s.trim()).filter(Boolean);
        if (chips.length > 0) return { kind: 'chips', label, source, chips };
    }

    // --- multi-line values (population census, multiple rulers) -> list ---
    if (value.querySelector('br')) {
        const lines = splitByBr(value);
        if (lines.length > 1) return { kind: 'lines', label, source, lines };
    }

    // --- fallback: plain text ---
    const text = normalizedText(value);
    if (!text) return null;
    return { kind: 'text', label, source, text };
}

function distributionParts(value: Element): InfoboxPart[] {
    const parts: InfoboxPart[] = [];
    let text = '';
    const flush = () => {
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (normalized) parts.push({ kind: 'text', text: normalized });
        text = '';
    };
    const visit = (node: Node): void => {
        if (node.nodeType === 3) { text += node.textContent ?? ''; return; }
        if (node.nodeType !== 1) return;
        const element = node as Element;
        if (element.matches('br')) { text += ' '; return; }
        if (element.matches('table.percentagetable')) {
            const tableRows = Array.from(element.querySelectorAll('tr'));
            const rows: InfoboxBar[] = tableRows.flatMap((tr) => {
                const cells = directChildren(tr, 'td');
                if (cells.length < 2) return [];
                const name = normalizedText(cells[0]);
                const label = normalizedText(cells[1]);
                const number = Number.parseFloat(label.replace(/[^0-9.]/g, ''));
                return [{ name, label, pct: Number.isFinite(number) ? number : null }];
            });
            if (rows.length) {
                flush();
                const caption = normalizedText(element.querySelector('caption'));
                if (caption) parts.push({ kind: 'text', text: caption });
                parts.push({ kind: 'bars', rows });
                return;
            }
        }
        element.childNodes.forEach(visit);
    };
    value.childNodes.forEach(visit);
    flush();
    return parts;
}

/** Split a value node on <br> into trimmed text fragments. */
function splitByBr(node: Element): string[] {
    const parts: string[] = [''];
    node.childNodes.forEach((n) => {
        if (n.nodeName === 'BR') parts.push('');
        else parts[parts.length - 1] += n.textContent ?? '';
    });
    return parts.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Remove prose leftovers that survive the main scrub: empty paragraphs, stray wrappers. */
function tidyProse(root: Element): void {
    root.querySelectorAll('p.mw-empty-elt, .rightscroll, figure, .floatleft, .floatright')
        .forEach((el) => { el.remove(); });
    root.querySelectorAll('p').forEach((p) => {
        if (!(p.textContent ?? '').trim() && !p.querySelector('img,table')) p.remove();
    });
}

function titleCase(s: string): string {
    return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
