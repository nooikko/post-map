import { LAYERS } from './config.js';
import { clampCenter } from './map-core.js';
import { escapeHtml } from './dom-util.js';

const MAX_RESULTS = 30;

/**
 * Search input + result list in the sidebar. Filters every feature across
 * every layer by name (case-insensitive substring). Clicking flies the
 * view to the feature and invokes onSelect (typically opens its popup).
 */
export function buildSearchControl(layers, container, map, onSelect) {
    const index = [];
    for (const def of LAYERS) {
        const bucket = layers[def.key];
        for (const feature of bucket.features) {
            const name = feature.get('name');
            index.push({
                feature,
                def,
                name,
                needle: name.toLowerCase(),
            });
        }
    }
    index.sort((a, b) => a.name.localeCompare(b.name));

    const wrap = document.createElement('div');
    wrap.className = 'search-control';

    const heading = document.createElement('h3');
    heading.textContent = 'Search';
    wrap.appendChild(heading);

    const inputRow = document.createElement('div');
    inputRow.className = 'search-input-row';

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = `Type a place name… (${index.length} known)`;
    input.className = 'search-input';
    input.autocomplete = 'off';
    input.spellcheck = false;

    inputRow.appendChild(input);
    wrap.appendChild(inputRow);

    const list = document.createElement('ul');
    list.className = 'search-results';
    list.hidden = true;
    wrap.appendChild(list);

    function render(query) {
        list.innerHTML = '';
        if (!query) {
            list.hidden = true;
            return;
        }
        const q = query.toLowerCase();
        const matches = [];
        for (const entry of index) {
            if (entry.needle.includes(q)) {
                matches.push(entry);
                if (matches.length >= MAX_RESULTS + 1) break;
            }
        }

        if (matches.length === 0) {
            const li = document.createElement('li');
            li.className = 'search-empty';
            li.textContent = 'No matches';
            list.appendChild(li);
        } else {
            const shown = matches.slice(0, MAX_RESULTS);
            for (const entry of shown) {
                list.appendChild(renderRow(entry, q));
            }
            if (matches.length > MAX_RESULTS) {
                const li = document.createElement('li');
                li.className = 'search-more';
                li.textContent = `…and more — refine your query`;
                list.appendChild(li);
            }
        }
        list.hidden = false;
    }

    function renderRow(entry, q) {
        const li = document.createElement('li');
        li.className = 'search-row';

        const dot = document.createElement('span');
        dot.className = 'search-dot';
        dot.style.background = entry.def.color;

        const name = document.createElement('span');
        name.className = 'search-name';
        name.innerHTML = highlight(entry.name, q);

        const type = document.createElement('span');
        type.className = 'search-type';
        type.textContent = entry.def.label;

        li.append(dot, name, type);
        li.addEventListener('click', () => {
            goTo(entry, map, onSelect);
            input.value = '';
            list.hidden = true;
        });
        return li;
    }

    input.addEventListener('input', () => render(input.value.trim()));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            list.hidden = true;
        }
        if (e.key === 'Enter') {
            const first = list.querySelector('.search-row');
            if (first) first.click();
        }
    });

    container.appendChild(wrap);
}

function goTo(entry, map, onSelect) {
    const view = map.getView();
    const coord = entry.feature.getGeometry().getCoordinates();
    const targetZoom = Math.max(view.getZoom(), 4);
    // Clamp at the destination resolution so an edge feature lands flush
    // against the viewport edge instead of centering (which would show
    // background past the map, then snap back on moveend).
    const size = map.getSize();
    const targetRes = view.getResolutionForZoom(targetZoom);
    const target = size ? clampCenter(coord, targetRes, size) : coord;
    view.animate(
        { center: target, zoom: targetZoom, duration: 700 },
        () => onSelect && onSelect(entry.feature),
    );
}

function highlight(name, q) {
    if (!q) return escapeHtml(name);
    const i = name.toLowerCase().indexOf(q);
    if (i < 0) return escapeHtml(name);
    return (
        escapeHtml(name.slice(0, i)) +
        `<mark>${escapeHtml(name.slice(i, i + q.length))}</mark>` +
        escapeHtml(name.slice(i + q.length))
    );
}
