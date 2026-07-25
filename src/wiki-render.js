// Turns a cleaned Fandom article (DocumentFragment/Element from wiki.js) into
// the two pieces the place panel needs:
//   - prose:   the readable article body, with the infobox aside removed
//   - groups:  the portable-infobox parsed into [{ heading, fields }]
//
// Fandom "portable-infobox" markup is regular:
//   aside.portable-infobox
//     section.pi-group
//       h2.pi-header                -> group heading (Geography, Society, …)
//       div.pi-data[data-source]
//         h3.pi-data-label          -> field label
//         div.pi-data-value         -> field value (may hold a table/<br> list)
//   div.pi-data may also sit directly under the aside (ungrouped).
//
// Everything here is non-mutating with respect to the input: we clone before
// pulling the aside out so the caller's node is untouched.

import { escapeHtml } from './dom-util.js';

/**
 * @param {Element} wrap  cleaned article wrapper from wiki.js
 * @returns {{ prose: Element, groups: Group[] }}
 *   Group = { heading: string|null, fields: Field[] }
 *   Field = { label: string, source: string, kind: string, ...payload }
 */
export function parseArticle(wrap) {
    const prose = wrap.cloneNode(true);
    const aside = prose.querySelector('aside.portable-infobox');
    const groups = aside ? parseInfobox(aside) : [];
    if (aside) aside.remove();
    tidyProse(prose);
    return { prose, groups };
}

function parseInfobox(aside) {
    const groups = [];

    // Ungrouped fields that appear before/outside any section get their own
    // bucket so nothing is silently dropped.
    let loose = null;

    for (const child of aside.children) {
        if (child.matches('section.pi-group')) {
            const heading = text(child.querySelector('.pi-header'));
            const fields = collectFields(child);
            if (fields.length) groups.push({ heading: heading || null, fields });
        } else if (child.matches('.pi-data')) {
            const f = parseField(child);
            if (f) {
                if (!loose) { loose = { heading: null, fields: [] }; groups.push(loose); }
                loose.fields.push(f);
            }
        }
    }
    return groups;
}

function collectFields(section) {
    const out = [];
    section.querySelectorAll(':scope > .pi-data').forEach((el) => {
        const f = parseField(el);
        if (f) out.push(f);
    });
    return out;
}

function parseField(el) {
    const label = text(el.querySelector('.pi-data-label')) || titleCase(el.dataset.source || '');
    const value = el.querySelector('.pi-data-value');
    if (!value) return null;
    const source = el.dataset.source || '';

    // --- races: percentagetable -> labelled bars ---
    const pct = value.querySelector('table.percentagetable');
    if (pct) {
        const rows = [];
        pct.querySelectorAll('tr').forEach((tr) => {
            const cells = tr.querySelectorAll('td');
            if (cells.length < 2) return;
            const name = text(cells[0]);
            const raw = text(cells[1]);
            const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
            rows.push({ name, label: raw, pct: Number.isFinite(num) ? num : null });
        });
        if (rows.length) return { kind: 'bars', label, source, rows };
    }

    // --- aliases / spelling -> chips (split on <br> OR commas; some pages
    //     list each alias on its own line, others comma-separate them) ---
    if (source === 'aliases' || source === 'alt spelling') {
        const raw = value.querySelector('br') ? splitByBr(value) : text(value).split(',');
        const chips = raw.map((s) => s.trim()).filter(Boolean);
        if (chips.length) return { kind: 'chips', label, source, chips };
    }

    // --- multi-line values (population census, multiple rulers) -> list ---
    if (value.querySelector('br')) {
        const lines = splitByBr(value);
        if (lines.length > 1) return { kind: 'lines', label, source, lines };
    }

    // --- fallback: plain text (collapse whitespace) ---
    const t = text(value);
    if (!t) return null;
    return { kind: 'text', label, source, text: t };
}

// Split a value node on <br> into an array of trimmed text fragments.
function splitByBr(node) {
    const parts = [''];
    node.childNodes.forEach((n) => {
        if (n.nodeName === 'BR') parts.push('');
        else parts[parts.length - 1] += n.textContent;
    });
    return parts.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// Remove prose leftovers that survive wiki.js cleanup: empty paragraphs and
// stray figure/scroll wrappers. Keep headings + paragraphs + tables.
function tidyProse(prose) {
    prose.querySelectorAll('p.mw-empty-elt, .rightscroll, figure, .floatleft, .floatright')
        .forEach((el) => el.remove());
    prose.querySelectorAll('p').forEach((p) => {
        if (!p.textContent.trim() && !p.querySelector('img,table')) p.remove();
    });
}

// ----- panel building (DOM out) -----

/**
 * Mount parsed prose + infobox groups into the two-column panel body.
 * With no infobox groups the prose spans full width (rail omitted).
 * @param {Element} body   the .wiki-body container
 * @param {Element} subEl  the header .wiki-subtitle node
 * @param {Element} prose  parsed prose element (from parseArticle)
 * @param {Group[]} groups parsed infobox groups (from parseArticle)
 */
export function renderPanel(body, subEl, prose, groups) {
    body.className = 'wiki-body';
    body.innerHTML = '';

    // Promote the primary alias into the header subtitle as the place's
    // epithet. The full alias set still lives in the rail, so show just the
    // first here — joining all of them duplicates the rail and overflows for
    // places like Silverymoon that carry a dozen nicknames.
    const aliasField = groups
        .flatMap((g) => g.fields)
        .find((f) => f.kind === 'chips' && f.source === 'aliases');
    if (aliasField && aliasField.chips.length) {
        subEl.textContent = aliasField.chips[0];
        subEl.hidden = false;
    }

    const grid = document.createElement('div');
    grid.className = 'wiki-grid';

    const proseCol = document.createElement('article');
    proseCol.className = 'wiki-prose';
    proseCol.appendChild(prose);
    grid.appendChild(proseCol);

    if (groups.length) {
        grid.classList.add('has-rail');
        grid.appendChild(buildRail(groups));
    }

    body.appendChild(grid);
}

function buildRail(groups) {
    const rail = document.createElement('aside');
    rail.className = 'wiki-rail';

    for (const group of groups) {
        const section = document.createElement('section');
        section.className = 'rail-group';
        if (group.heading) {
            const h = document.createElement('h3');
            h.className = 'rail-heading';
            h.textContent = group.heading;
            section.appendChild(h);
        }
        for (const field of group.fields) {
            section.appendChild(buildField(field));
        }
        rail.appendChild(section);
    }
    return rail;
}

function buildField(field) {
    const row = document.createElement('div');
    row.className = `rail-field rail-${field.kind}`;

    const label = document.createElement('div');
    label.className = 'rail-label';
    label.textContent = field.label;
    row.appendChild(label);

    const value = document.createElement('div');
    value.className = 'rail-value';

    if (field.kind === 'bars') {
        for (const r of field.rows) {
            const bar = document.createElement('div');
            bar.className = 'rail-bar';
            bar.innerHTML =
                `<span class="rail-bar-name">${escapeHtml(r.name)}</span>`
                + `<span class="rail-bar-track">`
                + `<span class="rail-bar-fill" style="width:${Math.min(100, Math.max(0, r.pct ?? 0))}%"></span></span>`
                + `<span class="rail-bar-pct">${escapeHtml(r.label)}</span>`;
            value.appendChild(bar);
        }
    } else if (field.kind === 'lines') {
        for (const line of field.lines) {
            const li = document.createElement('div');
            li.className = 'rail-line';
            li.textContent = line;
            value.appendChild(li);
        }
    } else if (field.kind === 'chips') {
        for (const chip of field.chips) {
            const c = document.createElement('span');
            c.className = 'rail-chip';
            c.textContent = chip;
            value.appendChild(c);
        }
    } else {
        value.textContent = field.text;
    }

    row.appendChild(value);
    return row;
}

function text(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

function titleCase(s) {
    return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
