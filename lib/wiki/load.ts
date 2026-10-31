import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { cleanArticle, parseFragment } from '@/lib/wiki/clean';
import { splitArticle } from '@/lib/wiki/infobox';
import { redirectTarget } from '@/lib/wiki/mirror';
import type { ArticleMeta, PlaceArticle } from '@/lib/wiki/types';

// Reads a place's article from the local mirror under
// public/data/Faerun/wiki/<name>.json. Files conform to
// schemas/wiki-article.schema.json. Nothing here touches the remote wiki —
// the mirror is a build input.
//
// Filenames are stored decoded ("Baldur's Gate.json"), so no encodeURIComponent
// step belongs on this path.

const WIKI_DIR = path.join(process.cwd(), 'public', 'data', 'Faerun', 'wiki');

const MAX_REDIRECT_DEPTH = 3;

interface WikiFile {
    name: string;
    status: 'ok' | 'missing' | 'error';
    title: string | null;
    pageId: number | null;
    html: string | null;
    error?: { code?: string; info?: string };
    source?: { wiki?: string; url?: string; fetchedAt?: string };
}

async function readArticleFile(pageName: string): Promise<WikiFile | null> {
    try {
        const raw = await readFile(path.join(WIKI_DIR, `${pageName}.json`), 'utf8');
        return JSON.parse(raw) as WikiFile;
    } catch {
        return null;
    }
}

function metaFor(article: WikiFile, pageName: string): ArticleMeta {
    return {
        name: article.title || article.name || pageName,
        title: article.title || article.name || pageName,
        fetchedAt: article.source?.fetchedAt ?? '',
    };
}

/**
 * Load and clean one place article.
 *
 * Returns null when we hold no usable article. Those places still get a route; the page
 * just says so. No CC BY-SA credit is rendered in that case because no wiki
 * text is being used.
 */
export async function loadArticle(pageName: string, depth = 0): Promise<PlaceArticle | null> {
    const article = await readArticleFile(pageName);
    if (article?.status !== 'ok' || !article.html) return null;

    // Some markers point at wiki redirect stubs (a renamed/respelled place).
    // Follow the redirect when the canonical article is in our mirror.
    const target = redirectTarget(article.html);
    if (target && depth < MAX_REDIRECT_DEPTH) {
        const followed = await loadArticle(target, depth + 1);
        if (followed) return followed;

        // Target isn't mirrored: credit the live wiki article we're pointing the
        // reader at, not the stub we happen to hold — so the name is the
        // redirect target, overriding the stub's own.
        return {
            meta: {
                name: target,
                title: target,
                fetchedAt: article.source?.fetchedAt ?? '',
            },
            proseHtml: '',
            groups: [],
            epithet: null,
            redirectTo: target.replace(/\s*\(disambiguation\)\s*$/i, ''),
        };
    }

    const { document, root } = parseFragment(article.html);
    cleanArticle(root, document);
    const { proseHtml, groups, epithet } = splitArticle(root);

    return {
        meta: metaFor(article, pageName),
        proseHtml,
        groups,
        epithet,
        redirectTo: null,
    };
}
