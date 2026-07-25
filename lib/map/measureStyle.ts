import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import type { FeatureLike } from 'ol/Feature.js';

// Measure-tool styling. Every stroke is double-stacked — a white halo under a
// red line — because the parchment map artwork eats single-tone markers.

const vertex = [
    new Style({
        image: new CircleStyle({
            radius: 9,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#1a1a1a', width: 1.5 }),
        }),
    }),
    new Style({
        image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#e53935' }) }),
    }),
];

const preview = [
    new Style({ stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.85)', width: 7 }) }),
    new Style({
        stroke: new Stroke({ color: 'rgba(229, 57, 53, 0.85)', width: 4, lineDash: [6, 6] }),
    }),
];

const committed = [
    new Style({ stroke: new Stroke({ color: '#ffffff', width: 8 }) }),
    new Style({ stroke: new Stroke({ color: '#e53935', width: 4 }) }),
];

export function measureStyle(feature: FeatureLike): Style[] {
    if (feature.getGeometry()?.getType() === 'Point') return vertex;
    return feature.get('preview') ? preview : committed;
}
