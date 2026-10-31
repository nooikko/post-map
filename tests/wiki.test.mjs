import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanArticle, parseFragment } from '../lib/wiki/clean.ts';
import { splitArticle } from '../lib/wiki/infobox.ts';
import { redirectTarget } from '../lib/wiki/mirror.ts';
import { keepsPrevious, normalize, stripImages } from '../scripts/fetch-redirect-targets.ts';

const response = (html) => ({
    parse: { title: 'Town', pageid: 123, revid: 456, text: { '*': html } },
});

test('ordinary disambiguation links retain their words, destination and infobox value', () => {
    const { root, document } = parseFragment(`
      <div class="hatnote"><a class="mw-disambig" href="/wiki/Other">Hatnote</a></div>
      <p>During <a class="mw-disambig" href="/wiki/Great_Fires">Great Fires</a>, the city burned.</p>
      <aside class="portable-infobox"><section class="pi-group">
        <div class="pi-data" data-source="event1"><h3 class="pi-data-label">319</h3>
          <div class="pi-data-value"><a class="mw-disambig" href="/wiki/Great_Fires">Great Fires</a><sup>[1]</sup></div>
        </div></section></aside>`);
    cleanArticle(root, document);
    const result = splitArticle(root);
    assert.match(
        result.proseHtml,
        /During <a[^>]+href="https:\/\/forgottenrealms.fandom.com\/wiki\/Great_Fires"[^>]*>Great Fires<\/a>, the city burned/,
    );
    assert.ok(!result.proseHtml.includes('Hatnote'));
    assert.equal(result.groups[0].fields[0].text, 'Great Fires');
});

test('sanitizer still blocks executable markup, unsafe links and injected attributes', () => {
    const { root, document } = parseFragment(
        '<p style="color:red" onclick="evil()">Keep me</p><script>evil()</script><img src=x onerror=evil()><a href="javascript:evil()">Words</a>',
    );
    cleanArticle(root, document);
    const { proseHtml } = splitArticle(root);
    assert.match(proseHtml, /Keep me/);
    assert.match(proseHtml, /Words/);
    assert.doesNotMatch(proseHtml, /evil|style=|onclick=|<img|<script/);
});

test('percentage fields preserve captions, historical qualifiers and subsequent tables', () => {
    const { root, document } = parseFragment(`<aside class="portable-infobox">
      <div class="pi-data" data-source="races"><h3 class="pi-data-label">Races</h3>
        <div class="pi-data-value">In 1371 DR:
          <table class="percentagetable"><caption>City citizens</caption>
            <tr><td>Human</td><td>85%</td></tr><tr><td>Other</td><td>15%</td></tr></table>
          <b>Outskirts workers</b><br>
          <table class="percentagetable"><tr><td>Human</td><td>88%</td></tr><tr><td>Other</td><td>12%</td></tr></table>
          <small>Formerly: dwarves</small>
        </div>
      </div></aside>`);
    cleanArticle(root, document);
    const field = splitArticle(root).groups[0].fields[0];
    assert.equal(field.kind, 'bars');
    assert.deepEqual(field.parts, [
        { kind: 'text', text: 'In 1371 DR:' },
        { kind: 'text', text: 'City citizens' },
        {
            kind: 'bars',
            rows: [
                { name: 'Human', label: '85%', pct: 85 },
                { name: 'Other', label: '15%', pct: 15 },
            ],
        },
        { kind: 'text', text: 'Outskirts workers' },
        {
            kind: 'bars',
            rows: [
                { name: 'Human', label: '88%', pct: 88 },
                { name: 'Other', label: '12%', pct: 12 },
            ],
        },
        { kind: 'text', text: 'Formerly: dwarves' },
    ]);
});

test('normalization strips imagery and records revision provenance', () => {
    const result = normalize(
        response(
            '<p>Text</p><figure>caption<img src=x></figure><p class="pi-image">image wrapper</p>',
        ),
        'Map label',
        'Town',
    );
    assert.equal(result.name, 'Map label');
    assert.equal(result.title, 'Town');
    assert.equal(result.source.revisionId, 456);
    assert.equal(new URL(result.source.url).searchParams.get('page'), 'Town');
    assert.equal(result.html, '<p>Text</p>');
    assert.equal(
        stripImages('<a href="https://static.wikia.nocookie.net/x">image</a><p>keep</p>'),
        '<p>keep</p>',
    );
    assert.equal(normalize({}, 'Town').status, 'error');
});

test('normalization distinguishes missing pages from API errors', () => {
    const missing = normalize({ error: { code: 'missingtitle', info: 'No such page' } }, 'Town');
    assert.equal(missing.status, 'missing');
    assert.equal(missing.html, null);
    assert.equal(normalize({ error: { code: 'ratelimited' } }, 'Town').status, 'error');
});

test('a failed refetch keeps the article already mirrored', () => {
    const good = { status: 'ok', html: '<p>Waterdeep</p>' };
    const failed = normalize({ error: { code: 'ratelimited' } }, 'Waterdeep');
    assert.equal(keepsPrevious(good, failed), true);
    assert.equal(keepsPrevious(good, normalize({}, 'Waterdeep')), true);
    assert.equal(keepsPrevious(null, failed), false);
    assert.equal(keepsPrevious({ status: 'error', html: null }, failed), false);
    const missing = normalize({ error: { code: 'missingtitle' } }, 'Waterdeep');
    assert.equal(keepsPrevious(good, missing), false);
});

test('redirect stubs resolve to their target page', () => {
    assert.equal(
        redirectTarget(
            '<div class="redirectMsg"><ul class="redirectText"><li><a title="Waterdeep">x</a></li></ul></div>',
        ),
        'Waterdeep',
    );
    assert.equal(
        redirectTarget('<div class="redirectMsg"><a>  City of\n Splendors </a></div>'),
        'City of Splendors',
    );
    assert.equal(redirectTarget('<p>A normal article</p>'), null);
});
