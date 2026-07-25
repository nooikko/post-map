import Overlay from 'ol/Overlay.js';

import { getWiki } from './wiki.js';
import { parseArticle, renderPanel } from './wiki-render.js';
import { buildArticleCredit } from './attribution.js';
import { escapeHtml } from './dom-util.js';

/**
 * Click a marker → opens a centered <dialog> modal with the wiki article.
 * Hover a marker → small tooltip with the feature name. Skipped while
 * the measure tool is active.
 */
export function attachWikiPopups(map, measure) {
    const dialog = createDialog();
    document.body.appendChild(dialog);
    const els = queryPanelEls(dialog);

    // Guards against a stale fetch painting into the panel after the user has
    // clicked a different marker.
    let openToken = 0;

    const { tooltipEl, overlay } = createTooltip(map);
    attachHoverTooltip(map, measure, tooltipEl, overlay);

    function close() {
        if (dialog.open) dialog.close();
    }

    function openFor(feature) {
        const def = feature.get('def');
        const name = feature.get('name');
        if (!def || !name) return;

        // A new place: bump a token so a slow fetch for the previous marker
        // can't paint into this panel after we've moved on.
        const token = ++openToken;
        showLoading(els, def, name);

        if (!dialog.open) dialog.showModal();
        tooltipEl.hidden = true;

        getWiki(name).then(({ wrap, meta }) => {
            if (token !== openToken) return;
            showArticle(els, wrap, meta);
        }).catch((err) => {
            if (token !== openToken) return;
            showError(els, err);
        });
    }

    map.on('click', (evt) => {
        if (measure.isActive()) return;
        const feature = map.forEachFeatureAtPixel(
            evt.pixel,
            (f) => f,
            { hitTolerance: 4 },
        );
        if (feature) openFor(feature);
    });

    return { openFor, close };
}

function createDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'wiki-dialog';
    dialog.innerHTML = `
        <header class="wiki-header">
            <span class="wiki-swatch"></span>
            <div class="wiki-heading">
                <span class="wiki-name"></span>
                <span class="wiki-subtitle" hidden></span>
            </div>
            <span class="wiki-type"></span>
            <button type="button" class="wiki-close" aria-label="Close">×</button>
        </header>
        <div class="wiki-body wiki-loading">
            <div class="wiki-status">Consulting the archives…</div>
        </div>
    `;

    dialog.querySelector('.wiki-close').addEventListener('click', () => dialog.close());
    // Click on the backdrop (the dialog element itself, outside the content
    // box) closes — same pattern as settings-ui.
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });

    return dialog;
}

function queryPanelEls(dialog) {
    return {
        swatch: dialog.querySelector('.wiki-swatch'),
        nameEl: dialog.querySelector('.wiki-name'),
        subEl:  dialog.querySelector('.wiki-subtitle'),
        typeEl: dialog.querySelector('.wiki-type'),
        body:   dialog.querySelector('.wiki-body'),
    };
}

// Reset the panel header for a new place and show the loading state.
function showLoading(els, def, name) {
    els.swatch.style.background = def.color;
    els.nameEl.textContent = name;
    els.subEl.textContent = '';
    els.subEl.hidden = true;
    els.typeEl.textContent = def.label;
    els.body.className = 'wiki-body wiki-loading';
    els.body.innerHTML = '<div class="wiki-status">Consulting the archives…</div>';
    els.body.scrollTop = 0;
}

// The credit line is appended after renderPanel (which clears the body), so
// every article view carries its CC BY-SA attribution and source backlink.
function showArticle(els, wrap, meta) {
    const { prose, groups } = parseArticle(wrap);
    renderPanel(els.body, els.subEl, prose, groups);
    if (meta) els.body.appendChild(buildArticleCredit(meta));
}

function showError(els, err) {
    els.body.className = 'wiki-body';
    // Friendly "missing" errors are self-explanatory; only surface a
    // technical detail line for genuinely unexpected failures.
    const detail = /archive entry/.test(err.message)
        ? ''
        : `<span class="muted">${escapeHtml(err.message)}</span>`;
    els.body.innerHTML =
        `<div class="wiki-status wiki-empty">No archive entry found for this place.${detail}</div>`;
}

// Hover tooltip stays anchored to the map via an OL Overlay.
function createTooltip(map) {
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'wiki-tooltip';
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
    const overlay = new Overlay({
        element: tooltipEl,
        positioning: 'bottom-center',
        offset: [0, -8],
        stopEvent: false,
    });
    map.addOverlay(overlay);
    return { tooltipEl, overlay };
}

// Single pointermove handler for cursor + tooltip — both gated on the
// same hit-test so we don't run forEachFeatureAtPixel twice per frame.
function attachHoverTooltip(map, measure, tooltipEl, overlay) {
    map.on('pointermove', (evt) => {
        if (measure.isActive() || evt.dragging) {
            map.getTargetElement().style.cursor = '';
            tooltipEl.hidden = true;
            return;
        }
        const feature = map.forEachFeatureAtPixel(
            evt.pixel,
            (f) => f,
            { hitTolerance: 4 },
        );
        if (feature && feature.get('name')) {
            map.getTargetElement().style.cursor = 'pointer';
            tooltipEl.textContent = feature.get('name');
            tooltipEl.hidden = false;
            overlay.setPosition(feature.getGeometry().getCoordinates());
        } else {
            map.getTargetElement().style.cursor = '';
            tooltipEl.hidden = true;
        }
    });
}
