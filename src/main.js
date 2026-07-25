import 'ol/ol.css';

// Self-hosted serifs for the place panel (bundled by Vite, precached by the
// SW so they work offline). Cormorant = display name, Spectral = prose body.
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/spectral/400.css';
import '@fontsource/spectral/400-italic.css';
import '@fontsource/spectral/500.css';
import '@fontsource/spectral/600.css';

import '../css/app.css';

import { createMap } from './map-core.js';
import { loadAllLayers, buildLayerToggles } from './layers.js';
import { setupMeasure, buildMeasureControl } from './measure.js';
import { attachWikiPopups } from './popups.js';
import { buildSearchControl } from './search.js';
import { buildSettingsButton } from './settings-ui.js';
import { buildCreditsSection } from './attribution.js';
import { registerSW } from './sw-register.js';

const { map } = createMap('map');

// Sidebar collapse toggle
const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('sidebar-toggle');
toggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    setTimeout(() => map.updateSize(), 200);  // after CSS transition
});

// Settings cog (top-right)
buildSettingsButton(document.querySelector('.topbar'));

// Service Worker — cache-first for tiles, stale-while-revalidate for shell + ol bundle
registerSW();

// Vector layers (markers). Search/popups iterate these.
const layers = await loadAllLayers(map);

// Measure tool — popups skip click handling while it's active.
const measure = setupMeasure(map);
const popups = attachWikiPopups(map, measure);

// Sidebar order: Search → Tools → Layers (most-used first), Credits last.
buildSearchControl(layers, sidebar, map, (feature) => popups.openFor(feature));
buildMeasureControl(measure, sidebar);
buildLayerToggles(layers, sidebar);
buildCreditsSection(sidebar);

// Debug handles
window.__map = map;
window.__layers = layers;
window.__measure = measure;
