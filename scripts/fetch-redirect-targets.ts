import { realpathSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { WIKI_HOST } from '../lib/attribution.ts';
import { LAYERS } from '../lib/map/config.ts';
import { ARTICLE_NAMES } from '../lib/wiki/article-names.ts';
import { parseFragment } from '../lib/wiki/clean.ts';
import {
    IMAGE_DROP_CLASSES,
    IMAGE_DROP_TAGS,
    WIKIA_CDN_HOST,
    isDisambiguation,
    isSafeName,
    redirectTarget,
} from '../lib/wiki/mirror.ts';

const WIKI_DIR = path.join(import.meta.dirname, '..', 'public', 'data', 'Faerun', 'wiki');
const API = `https://${WIKI_HOST}/api.php`;
const UA = 'post-map/1.0 (build-time mirror; personal project)';
const TIMEOUT_MS = 30_000;

interface MirrorFile {
    name: string;
    status: 'ok' | 'missing' | 'error';
    title: string | null;
    pageId: number | null;
    html: string | null;
    error: { code: string; info: string } | null;
    source: { wiki: string; url: string; fetchedAt: string; revisionId?: number };
}

function quote(value: string): string {
    return encodeURIComponent(value).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function sourceUrl(name: string): string {
    return `${API}?action=parse&format=json&prop=text%7Crevid&page=${quote(name)}`;
}

/**
 * Drop every image and image wrapper. The mirror carries no article imagery —
 * see NOTICE — so this runs before anything is written to disk, not at render
 * time.
 */
export function stripImages(html: string): string {
    const { root } = parseFragment(html);
    const selectors = [
        ...IMAGE_DROP_TAGS,
        ...IMAGE_DROP_CLASSES.map((c) => `.${c}`),
        '[data-source="image"]',
        `a[href*="${WIKIA_CDN_HOST}"]`,
    ];
    root.querySelectorAll(selectors.join(',')).forEach((el) => {
        el.remove();
    });

    return root.innerHTML;
}

async function findTargets(force: boolean, all: boolean): Promise<string[]> {
    const files = (await readdir(WIKI_DIR)).filter((f) => f.endsWith('.json'));
    const have = new Set(files.map((f) => path.basename(f, '.json')));
    const targets = new Set<string>();
    if (all) {
        for (const name of have) targets.add(name);
        for (const layer of LAYERS) {
            const raw = await readFile(path.join(WIKI_DIR, '..', `${layer.key}.json`), 'utf8');
            const collection: { features: Array<{ properties: { name: string } }> } = JSON.parse(
                raw.replace(/^\uFEFF/, ''),
            );
            for (const { properties } of collection.features) {
                if (isSafeName(properties.name)) {
                    targets.add(properties.name);
                } else {
                    console.warn(
                        `  warning: skipping unsafe marker name ${JSON.stringify(properties.name)} in ${layer.key}.json`,
                    );
                }
            }
        }
        return [...targets].sort();
    }

    for (const file of files) {
        let article: Partial<MirrorFile>;
        try {
            article = JSON.parse(await readFile(path.join(WIKI_DIR, file), 'utf8'));
        } catch (err) {
            console.warn(`  warning: skipping unreadable ${file}: ${(err as Error).message}`);
            continue;
        }
        if (article.status !== 'ok' || !article.html) continue;

        const target = redirectTarget(article.html);
        if (!target || isDisambiguation(target)) continue;
        if (!isSafeName(target)) {
            console.warn(
                `  warning: skipping unsafe redirect target ${JSON.stringify(target)} in ${file}`,
            );
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

/**
 * The slice of a MediaWiki action=parse response this script reads. Narrowed
 * from `unknown` rather than trusted: the body is whatever the network handed
 * back, and every field here is optional because an error response carries
 * none of them.
 */
interface ParseResponse {
    error?: { code?: string; info?: string };
    parse?: { title?: string; pageid?: number; revid?: number; text?: { '*'?: string } };
}

function isParseResponse(value: unknown): value is ParseResponse {
    return typeof value === 'object' && value !== null;
}

/** Shape an API response into the on-disk envelope, keys in schema order. */
export function normalize(raw: unknown, name: string, requestedName = name): MirrorFile {
    const body: ParseResponse = isParseResponse(raw) ? raw : {};
    const source = {
        wiki: WIKI_HOST,
        url: sourceUrl(requestedName),
        fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };

    if (body.error) {
        const code = body.error.code ?? 'unknown';
        return {
            name,
            status: code === 'missingtitle' ? 'missing' : 'error',
            title: null,
            pageId: null,
            html: null,
            error: { code, info: body.error.info ?? '' },
            source,
        };
    }

    const html = body.parse?.text?.['*'];
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
        title: body.parse?.title ?? null,
        pageId: body.parse?.pageid ?? null,
        html: stripImages(html),
        error: null,
        source: { ...source, ...(body.parse?.revid ? { revisionId: body.parse.revid } : {}) },
    };
}

/**
 * A failed refetch must not cost us an article we already hold: an `error`
 * result (rate limit, maintenance, empty body) never replaces a good file.
 * `missing` does — the wiki saying the page is gone is an answer, not a fault.
 */
export function keepsPrevious(previous: Partial<MirrorFile> | null, next: MirrorFile): boolean {
    return next.status === 'error' && previous?.status === 'ok' && Boolean(previous.html);
}

async function readPrevious(name: string): Promise<Partial<MirrorFile> | null> {
    try {
        return JSON.parse(await readFile(path.join(WIKI_DIR, `${name}.json`), 'utf8'));
    } catch {
        return null;
    }
}

async function write(name: string, article: MirrorFile): Promise<void> {
    if (!isSafeName(name)) throw new Error(`unsafe article name: ${JSON.stringify(name)}`);
    await mkdir(WIKI_DIR, { recursive: true });
    await writeFile(path.join(WIKI_DIR, `${name}.json`), JSON.stringify(article), 'utf8');
}

async function main(): Promise<number> {
    const force = process.argv.includes('--force');
    const all = process.argv.includes('--all');
    const targets = new Set(await findTargets(force, all));
    console.log(`${targets.size} ${all ? 'articles' : 'redirect targets'} to fetch`);

    const stats = { ok: 0, missing: 0, error: 0 };
    let failed = 0;

    for (const name of targets) {
        const requestedName = Object.hasOwn(ARTICLE_NAMES, name) ? ARTICLE_NAMES[name] : name;
        let raw: unknown;
        try {
            raw = await fetchArticle(requestedName);
        } catch (err) {
            console.error(`  ${name}: fetch failed: ${(err as Error).message}`);
            failed += 1;
            continue;
        }
        const article = normalize(raw, name, requestedName);
        stats[article.status] += 1;
        if (keepsPrevious(await readPrevious(name), article)) {
            console.error(`  ${name}: ${article.error?.code}; kept the previous article`);
            continue;
        }
        await write(name, article);
        const target = article.html ? redirectTarget(article.html) : null;
        if (all && target && !isDisambiguation(target) && isSafeName(target)) targets.add(target);
        console.log(`  ${name}: ${article.status} (${article.html?.length ?? 0} chars)`);
    }

    console.log(`done: ${JSON.stringify(stats)}${failed ? `, ${failed} failed` : ''}`);

    return failed || stats.error ? 1 : 0;
}

// Compare real paths: import.meta.filename is resolved through symlinks, argv[1] is as typed.
if (process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename) {
    process.exitCode = await main();
}
