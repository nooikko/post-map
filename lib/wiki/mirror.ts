// Facts shared between the runtime that READS the wiki mirror and the script
// that WRITES it (scripts/fetch-redirect-targets.ts).
//
// This module is deliberately dependency-free — no imports at all — for the
// same reason lib/attribution.ts is: `node --experimental-strip-types` does not
// resolve the `@/` path alias, so a script can only pull from modules that
// import nothing. Keep it that way, or the fetch script stops running.
//
// The point of sharing is drift: if the script's idea of "this is a redirect
// stub" ever diverges from lib/wiki/load.ts's, the script fetches targets the
// runtime will never follow, and the mirror grows files nothing reads.

/** Fandom renders a redirect as `.redirectMsg` wrapping a link to the target. */
export const REDIRECT_SELECTOR = '.redirectMsg .redirectText a, .redirectMsg a';

/** Media elements dropped from mirrored HTML — see NOTICE: no article images. */
export const IMAGE_DROP_TAGS = [
    'img', 'figure', 'picture', 'noscript', 'svg', 'map', 'area', 'source',
] as const;

/** Fandom wrappers whose only purpose is holding an image. */
export const IMAGE_DROP_CLASSES = [
    'image', 'image-thumbnail', 'image-no-lightbox', 'thumb', 'thumbinner',
    'thumbimage', 'thumbcaption', 'gallery', 'gallery-image-wrapper',
    'pi-image', 'pi-image-thumbnail', 'pi-image-collection',
] as const;

/** Fandom's image CDN. Links straight to it are dropped along with the images. */
export const WIKIA_CDN_HOST = 'static.wikia.nocookie.net';

/**
 * The mirror file envelope, in order. Written in this order so re-fetching an
 * article produces a minimal diff against what is already committed.
 * Mirrors schemas/wiki-article.schema.json.
 */
export const SCHEMA_KEYS = [
    'name', 'status', 'title', 'pageId', 'html', 'error', 'source',
] as const;

/**
 * Article names become filenames, so only bare names are allowed — no path
 * separators, no dot components. A wiki page called `../../etc/passwd` must not
 * be able to steer a write out of the mirror directory.
 */
export function isSafeName(name: string): boolean {
    if (!name || name === '.' || name === '..') return false;
    return !/[/\\]/.test(name) && !name.includes('\0');
}

/** Disambiguation pages are indexes, not articles — never worth mirroring. */
export function isDisambiguation(name: string): boolean {
    return /\(disambiguation\)\s*$/i.test(name);
}
