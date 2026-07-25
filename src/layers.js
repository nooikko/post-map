import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';

import { LAYERS } from './config.js';
import { pixelToCoord } from './map-core.js';

/**
 * One OL VectorLayer per LAYERS entry, with every feature as a
 * canvas-rendered circle. Returns { key → { def, layer, source, features } }.
 */
export async function loadAllLayers(map) {
    const results = await Promise.all(
        LAYERS.map(async (def) => {
            const geo = await fetchGeoJSON(`data/Faerun/${def.key}.json`);
            const source = new VectorSource({ wrapX: false });
            const features = [];

            for (const f of geo.features) {
                const [x, y] = f.geometry.coordinates;
                const feature = new Feature({
                    geometry: new Point(pixelToCoord(x, y)),
                });
                feature.setId(`${def.key}:${f.properties.name}`);
                feature.set('name', f.properties.name);
                feature.set('def', def);
                feature.set('layerKey', def.key);
                source.addFeature(feature);
                features.push(feature);
            }

            const layer = new VectorLayer({
                source,
                style: makeZoomScaledStyle(def),
                // Repaint vectors while panning/zooming/animating. OL
                // defaults both to false to skip work during interactions,
                // which makes dots vanish until mouseup. We have only a
                // few hundred points per category — the per-frame cost is
                // trivial and continuous visibility is the whole point.
                updateWhileAnimating: true,
                updateWhileInteracting: true,
                // OL only queries the source for features within
                // viewport ± renderBuffer (default 100px). At z=6 that's
                // a tiny margin — a quick pan reveals features beyond it
                // that the renderer hasn't picked up yet, so they stay
                // hidden until interaction-end forces a fresh query.
                // For a few hundred points the source RTree is cheap;
                // overscanning doesn't hurt.
                renderBuffer: 2000,
            });
            layer.set('layerKey', def.key);
            map.addLayer(layer);

            return [def.key, { def, layer, source, features }];
        }),
    );

    return Object.fromEntries(results);
}

/**
 * Build a style function that scales the circle radius up at high zoom
 * so dots stay prominent against the detailed map. Resolutions for our
 * 7-level pyramid: z=0→32, z=1→16, z=2→8, z=3→4, z=4→2, z=5→1, z=6→0.5.
 * Caches one Style per zoom tier so OL doesn't allocate per feature
 * per render.
 */
function makeZoomScaledStyle(def) {
    const make = (r) => new Style({
        image: new CircleStyle({
            radius: r,
            fill: new Fill({ color: hexAlpha(def.color, 0.92) }),
            stroke: new Stroke({ color: '#000', width: 1 }),
        }),
    });
    const tiers = {
        z6: make(def.radius * 2.0),
        z5: make(def.radius * 1.6),
        z4: make(def.radius * 1.3),
        z3: make(def.radius * 1.1),
        base: make(def.radius),
    };
    return (_feature, resolution) => {
        if (resolution <= 0.5) return tiers.z6;
        if (resolution <= 1)   return tiers.z5;
        if (resolution <= 2)   return tiers.z4;
        if (resolution <= 4)   return tiers.z3;
        return tiers.base;
    };
}

async function fetchGeoJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    // Some files are saved with a UTF-8 BOM
    const text = await res.text();
    return JSON.parse(text.replace(/^﻿/, ''));
}

function hexAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Sidebar checkbox list. Toggling flips the OL layer's visibility.
 */
export function buildLayerToggles(layers, container) {
    const wrap = document.createElement('div');
    wrap.className = 'layer-list';

    const heading = document.createElement('h3');
    heading.textContent = 'Layers';
    wrap.appendChild(heading);

    LAYERS.forEach((def) => {
        const { layer, features } = layers[def.key];

        const row = document.createElement('label');
        row.className = 'layer-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.addEventListener('change', () => layer.setVisible(cb.checked));

        const dot = document.createElement('span');
        dot.className = 'layer-dot';
        dot.style.background = def.color;
        dot.style.width = `${def.radius * 2}px`;
        dot.style.height = `${def.radius * 2}px`;

        const label = document.createElement('span');
        label.className = 'layer-label';
        label.textContent = def.label;

        const count = document.createElement('span');
        count.className = 'layer-count';
        count.textContent = features.length;

        row.append(cb, dot, label, count);
        wrap.appendChild(row);
    });

    container.appendChild(wrap);
    return wrap;
}
