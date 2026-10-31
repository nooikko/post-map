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
