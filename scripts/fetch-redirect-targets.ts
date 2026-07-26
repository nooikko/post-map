// Fetch the canonical articles that our redirect-stub markers point at.
//
// Several markers (Velprintalar, Ithmong) resolve to wiki redirect stubs whose
// real content lives under a renamed or respelled title (Veltalar, Darromar).
// Only a few of those targets were in the original mirror, so the panel could
// only show a "recorded in the lore as X" note. This scans the mirror for
// redirect stubs, finds the targets we are missing, fetches them through the
// same fetch -> strip-images -> normalize pipeline, and writes them under the
// TARGET name so the runtime's redirect-follow resolves to a full article.
//
//   pnpm fetch:redirects            fetch only what is missing
//   pnpm fetch:redirects --force    re-fetch targets already on disk
//
// Ported from scripts/fetch_redirect_targets.py (bs4 + urllib). linkedom does
// the DOM work; the shared selectors and the file envelope live in
// lib/wiki/mirror.ts so this script and the runtime cannot disagree about what
// a redirect stub is.
//
// Imports are relative and reach only dependency-free modules on purpose:
// `node --experimental-strip-types` does not resolve the `@/` alias.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parseHTML } from 'linkedom';

import { WIKI_HOST } from '../lib/attribution.ts';
import {
    IMAGE_DROP_CLASSES,
    IMAGE_DROP_TAGS,
    REDIRECT_SELECTOR,
    WIKIA_CDN_HOST,
    isDisambiguation,
    isSafeName,
} from '../lib/wiki/mirror.ts';

const WIKI_DIR = path.join(import.meta.dirname, '..', 'public', 'data', 'Faerun', 'wiki');
const API = `https://${WIKI_HOST}/api.php`;
const UA = 'post-map/1.0 (local offline mirror; personal project)';
const TIMEOUT_MS = 30_000;

interface MirrorFile {
    name: string;
    status: 'ok' | 'missing' | 'error';
    title: string | null;
    pageId: number | null;
    html: string | null;
    error: { code: string; info: string } | null;
    source: { wiki: string; url: string; fetchedAt: string };
}

/**
 * Percent-encode the way Python's urllib.parse.quote does. encodeURIComponent
 * leaves `!'()*` alone and quote does not, which would silently rewrite the
 * stored `source.url` of every page with parentheses in its title (there is at
 * least one: "Dragon Falls (village)"). Matching the old encoder keeps
 * re-fetches diff-clean against what the Python script committed.
 */
function quote(value: string): string {
    return encodeURIComponent(value).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function sourceUrl(name: string): string {
    return `${API}?action=parse&format=json&prop=text&page=${quote(name)}`;
}

/**
 * Drop every image and image wrapper. The mirror carries no article imagery —
 * see NOTICE — so this runs before anything is written to disk, not at render
 * time.
 */
function stripImages(html: string): string {
    const { document } = parseHTML(`<!doctype html><body><div id="root">${html}</div></body>`);
    const root = document.getElementById('root');
    if (!root) return html;

    const selectors = [
        ...IMAGE_DROP_TAGS,
        ...IMAGE_DROP_CLASSES.map((c) => `.${c}`),
        '[data-source="image"]',
        `a[href*="${WIKIA_CDN_HOST}"]`,
    ];
    root.querySelectorAll(selectors.join(',')).forEach((el) => el.remove());

    return root.innerHTML;
}

function redirectTargetOf(html: string): string | null {
    const { document } = parseHTML(`<!doctype html><body><div id="root">${html}</div></body>`);
    const link = document.getElementById('root')?.querySelector(REDIRECT_SELECTOR);
    if (!link) return null;
    const raw = link.getAttribute('title') || (link.textContent ?? '').replace(/\s+/g, ' ');
    return raw.trim() || null;
}

/** Scan the mirror for redirect stubs and report the targets we do not hold. */
async function findTargets(force: boolean): Promise<string[]> {
    const files = (await readdir(WIKI_DIR)).filter((f) => f.endsWith('.json'));
    const have = new Set(files.map((f) => path.basename(f, '.json')));
    const targets = new Set<string>();

    for (const file of files) {
        let article: Partial<MirrorFile>;
        try {
            article = JSON.parse(await readFile(path.join(WIKI_DIR, file), 'utf8'));
        } catch (err) {
            console.warn(`  warning: skipping unreadable ${file}: ${(err as Error).message}`);
            continue;
        }
        if (article.status !== 'ok' || !article.html) continue;

        const target = redirectTargetOf(article.html);
        if (!target || isDisambiguation(target)) continue;
        if (!isSafeName(target)) {
            console.warn(`  warning: skipping unsafe redirect target ${JSON.stringify(target)} in ${file}`);
            continue;
        }
        if (force || !have.has(target)) targets.add(target);
    }

    return [...targets].sort();
}

async function fetchArticle(name: string): Promise<unknown> {
    const res = await fetch(sourceUrl(name), {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
}

/** Shape an API response into the on-disk envelope, keys in schema order. */
function normalize(raw: any, name: string): MirrorFile {
    const source = { wiki: WIKI_HOST, url: sourceUrl(name), fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };

    if (raw?.error) {
        const code = raw.error.code ?? 'unknown';
        return {
            name,
            status: code === 'missingtitle' ? 'missing' : 'error',
            title: null,
            pageId: null,
            html: null,
            error: { code, info: raw.error.info ?? '' },
            source,
        };
    }

    const html = raw?.parse?.text?.['*'];
    if (html == null) {
        return {
            name,
            status: 'error',
            title: null,
            pageId: null,
            html: null,
            error: { code: 'no-content', info: 'no parse.text' },
            source,
        };
    }

    return {
        name,
        status: 'ok',
        title: raw.parse.title ?? null,
        pageId: raw.parse.pageid ?? null,
        html: stripImages(html),
        error: null,
        source,
    };
}

async function write(name: string, article: MirrorFile): Promise<void> {
    if (!isSafeName(name)) throw new Error(`unsafe article name: ${JSON.stringify(name)}`);
    await mkdir(WIKI_DIR, { recursive: true });
    await writeFile(path.join(WIKI_DIR, `${name}.json`), JSON.stringify(article), 'utf8');
}

async function main(): Promise<number> {
    const force = process.argv.includes('--force');

    const targets = await findTargets(force);
    console.log(`${targets.length} redirect targets to fetch${force ? ' (--force)' : ''}: ${JSON.stringify(targets)}`);

    const stats = { ok: 0, missing: 0, error: 0 };

    for (const name of targets) {
        let raw: unknown;
        try {
            raw = await fetchArticle(name);
        } catch (err) {
            console.error(`  ${name}: fetch failed: ${(err as Error).message}`);
            continue;
        }
        const article = normalize(raw, name);
        await write(name, article);
        stats[article.status] += 1;
        console.log(`  ${name}: ${article.status} (${article.html?.length ?? 0} chars)`);
    }

    console.log(`done: ${JSON.stringify(stats)}`);
    return 0;
}

process.exitCode = await main();
