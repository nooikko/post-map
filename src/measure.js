import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import CircleStyle from 'ol/style/Circle.js';
import Overlay from 'ol/Overlay.js';
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom.js';

import { METERS_PER_PIXEL } from './config.js';
import { formatDistance, subscribe as onSettingsChange } from './settings.js';

function totalMeters(coords) {
    let sum = 0;
    for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1];
        const b = coords[i];
        sum += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return sum * METERS_PER_PIXEL;
}

export function setupMeasure(map) {
    let active = false;
    let coords = [];
    let lineFeature = null;
    let previewFeature = null;

    const source = new VectorSource();
    const layer = new VectorLayer({
        source,
        updateWhileAnimating: true,
        updateWhileInteracting: true,
        style: (feature) => {
            const geom = feature.getGeometry();
            if (geom.getType() === 'Point') {
                // Double-stack: white outer ring as a halo, red inner dot.
                // The map's parchment background eats single-tone markers.
                return [
                    new Style({
                        image: new CircleStyle({
                            radius: 9,
                            fill: new Fill({ color: '#ffffff' }),
                            stroke: new Stroke({ color: '#1a1a1a', width: 1.5 }),
                        }),
                    }),
                    new Style({
                        image: new CircleStyle({
                            radius: 5,
                            fill: new Fill({ color: '#e53935' }),
                        }),
                    }),
                ];
            }
            if (feature.get('preview')) {
                return [
                    new Style({
                        stroke: new Stroke({
                            color: 'rgba(255, 255, 255, 0.85)',
                            width: 7,
                        }),
                    }),
                    new Style({
                        stroke: new Stroke({
                            color: 'rgba(229, 57, 53, 0.85)',
                            width: 4,
                            lineDash: [6, 6],
                        }),
                    }),
                ];
            }
            // Committed segments: white halo under a solid red line.
            return [
                new Style({
                    stroke: new Stroke({
                        color: '#ffffff',
                        width: 8,
                    }),
                }),
                new Style({
                    stroke: new Stroke({
                        color: '#e53935',
                        width: 4,
                    }),
                }),
            ];
        },
    });
    map.addLayer(layer);

    // The native double-click-zoom interaction would fire alongside our
    // own dblclick-to-finish handler. Toggle it off while measuring.
    let dblZoom = null;
    map.getInteractions().forEach((i) => {
        if (i instanceof DoubleClickZoom) dblZoom = i;
    });

    const badge = document.createElement('div');
    badge.className = 'measure-badge';
    badge.hidden = true;
    document.body.appendChild(badge);

    // Floating tip near the cursor — shows the live distance from the last
    // committed point. Hidden until measuring is active and at least one
    // point has been placed.
    const cursorTip = document.createElement('div');
    cursorTip.className = 'measure-cursor-tip';
    const cursorOverlay = new Overlay({
        element: cursorTip,
        offset: [0, 0],
        positioning: 'bottom-left',
        stopEvent: false,
    });
    map.addOverlay(cursorOverlay);
    cursorOverlay.setPosition(undefined);

    function updateBadge() {
        const m = totalMeters(coords);
        badge.textContent = coords.length < 2
            ? 'Click another point to measure'
            : `Total: ${formatDistance(m)} · ${coords.length - 1} segments`;
    }

    function onClick(evt) {
        if (!active) return;
        const coord = evt.coordinate;
        coords = [...coords, coord];
        source.addFeature(new Feature({ geometry: new Point(coord) }));
        if (!lineFeature) {
            lineFeature = new Feature({ geometry: new LineString(coords) });
            source.addFeature(lineFeature);
        } else {
            lineFeature.getGeometry().setCoordinates(coords);
        }
        updateBadge();
    }

    function onMove(evt) {
        if (!active || coords.length === 0) {
            cursorOverlay.setPosition(undefined);
            return;
        }
        const last = coords[coords.length - 1];
        if (!previewFeature) {
            previewFeature = new Feature({
                geometry: new LineString([last, evt.coordinate]),
            });
            previewFeature.set('preview', true);
            source.addFeature(previewFeature);
        } else {
            previewFeature.getGeometry().setCoordinates([last, evt.coordinate]);
        }
        const segMeters = Math.hypot(
            evt.coordinate[0] - last[0],
            evt.coordinate[1] - last[1],
        ) * METERS_PER_PIXEL;
        cursorTip.textContent = formatDistance(segMeters);
        cursorOverlay.setPosition(evt.coordinate);
    }

    function onDblClick(evt) {
        if (!active) return;
        // stopPropagation prevents the click that precedes a dblclick
        // from adding a duplicate point at the same spot.
        evt.preventDefault();
        evt.stopPropagation();
        finish();
    }

    function onKey(e) {
        if (!active) return;
        if (e.key === 'Escape') {
            clear();
            deactivate();
        }
    }

    function finish() {
        if (previewFeature) {
            source.removeFeature(previewFeature);
            previewFeature = null;
        }
        active = false;
        document.body.classList.remove('measuring');
        cursorOverlay.setPosition(undefined);
        if (dblZoom) dblZoom.setActive(true);
        if (coords.length < 2) {
            clear();
            badge.hidden = true;
        }
    }

    function clear() {
        source.clear();
        lineFeature = null;
        previewFeature = null;
        coords = [];
        badge.hidden = true;
        cursorOverlay.setPosition(undefined);
    }

    function activate() {
        if (active) return;
        clear();
        active = true;
        document.body.classList.add('measuring');
        badge.hidden = false;
        badge.textContent = 'Click to start · double-click to finish · Esc to cancel';
        if (dblZoom) dblZoom.setActive(false);
    }

    function deactivate() {
        active = false;
        document.body.classList.remove('measuring');
        if (previewFeature) {
            source.removeFeature(previewFeature);
            previewFeature = null;
        }
        cursorOverlay.setPosition(undefined);
        if (dblZoom) dblZoom.setActive(true);
        if (coords.length < 2) badge.hidden = true;
    }

    function toggle() {
        if (active) {
            clear();
            deactivate();
        } else {
            activate();
        }
    }

    map.on('click', onClick);
    map.on('pointermove', onMove);
    map.on('dblclick', onDblClick);
    document.addEventListener('keydown', onKey);

    onSettingsChange(() => updateBadge());

    return { activate, deactivate, toggle, clear, isActive: () => active };
}

/**
 * "Measure" + "Clear" buttons for the sidebar tools section.
 */
export function buildMeasureControl(measure, container) {
    const wrap = document.createElement('div');
    wrap.className = 'measure-control';
    const heading = document.createElement('h3');
    heading.textContent = 'Tools';
    wrap.appendChild(heading);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-btn';
    btn.innerHTML = '<span class="tool-icon">📏</span><span>Measure distance</span>';
    btn.addEventListener('click', () => {
        measure.toggle();
        btn.classList.toggle('active', measure.isActive());
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'tool-btn tool-btn--ghost';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
        measure.clear();
        measure.deactivate();
        btn.classList.remove('active');
    });

    wrap.append(btn, clearBtn);
    container.appendChild(wrap);
}
