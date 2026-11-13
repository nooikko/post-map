import assert from 'node:assert/strict';
import test from 'node:test';

import { bearing, formatMilesAndKm, nearestPlaces, reverse } from '../lib/place/nearby.ts';

const at = (slug, x, y, name = slug) => ({ slug, name, category: 'Cities', x, y });

test('bearings read north-up, with image y growing downward', () => {
    const origin = at('origin', 100, 100);
    assert.equal(bearing(origin, at('a', 100, 50)), 'north');
    assert.equal(bearing(origin, at('a', 150, 50)), 'north-east');
    assert.equal(bearing(origin, at('a', 150, 100)), 'east');
    assert.equal(bearing(origin, at('a', 100, 150)), 'south');
    assert.equal(bearing(origin, at('a', 50, 150)), 'south-west');
    assert.equal(bearing(origin, at('a', 50, 100)), 'west');
    assert.equal(reverse('north-east'), 'south-west');
    assert.equal(reverse('west'), 'east');
});

test('nearest places come nearest first and skip the place itself and its namesakes', () => {
    const origin = at('home', 0, 0, 'Home');
    const markers = [
        origin,
        at('home-2', 1, 1, 'Home'),
        at('far', 300, 0),
        at('near', 0, 10),
        at('mid', 50, 0),
    ];
    const nearby = nearestPlaces(origin, markers, 2);
    assert.deepEqual(
        nearby.map((p) => [p.slug, p.bearing]),
        [
            ['near', 'south'],
            ['mid', 'east'],
        ],
    );
});

test('distances are given in both units', () => {
    assert.equal(formatMilesAndKm(1609.344 * 34), '34 miles (55 km)');
    assert.equal(formatMilesAndKm(1609.344 * 2.5), '2.5 miles (4 km)');
});
