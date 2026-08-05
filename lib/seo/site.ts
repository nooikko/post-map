// Every fact a search engine is told about this site, in one place.
//
// These strings are written for a search engine and a person reading a result
// page at once. If a phrase below ever stops being true of the site, it comes
// out.

import { PROJECT_NAME } from '@/lib/attribution';

/**
 * Canonical origin. Every absolute URL in metadata, the sitemap and the
 * structured data is built from this, so a domain move is one value.
 *
 * A canonical URL has to be stable and absolute — Vercel's preview deployments
 * each get their own hostname, and pointing canonicals at one of those would
 * hand search engines a URL that stops existing at the next push. So this is
 * deliberately *not* derived from VERCEL_URL; the default below is the live
 * domain, and NEXT_PUBLIC_SITE_URL overrides it for a fork or a move.
 *
 * The site answers on post-map.vercel.app as well. That address is not a second
 * home for it: everything canonical, every sitemap entry and every og:url
 * points here, so the two do not compete for the same rankings. Vercel should
 * be left to 308 the vercel.app hostname at this one — with the custom domain
 * set as production, that is its default behaviour and it is the right one.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://postmap.findquinn.com')
    .replace(/\/+$/, '');

/** Absolute URL for a root-relative path. */
export function absoluteUrl(path: string): string {
    return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const SITE_NAME = PROJECT_NAME;

/**
 * The <title> for the map. Descriptive words lead, not the brand — nobody is
 * searching for "Post Map" yet. Keep it under ~60 characters or Google
 * truncates it.
 */
export const HOME_TITLE = 'Interactive Map of Faerûn — Forgotten Realms D&D Map';

/**
 * The <meta name="description">, and the snippet that earns the click. Leads
 * with what the page is and what you can do on it; Google rewrites descriptions
 * it finds unhelpful. Under 160 characters or it is cut mid-sentence.
 */
export const SITE_DESCRIPTION =
    'Free interactive map of Faerûn for D&D — pan and zoom the 3rd-edition '
    + 'Forgotten Realms map, search 297 cities and ruins, and measure travel distances.';

/**
 * The checked-in record of what this site is trying to rank for — the copy,
 * headings and structured data are all written around these phrases. Google has
 * ignored the tag itself since 2009; Bing treats a stuffed one as a spam
 * signal, so a list that outgrows the page it describes is the failure mode.
 */
export const SITE_KEYWORDS: readonly string[] = [
    'map of Faerûn',
    'Faerun map',
    'Forgotten Realms map',
    'interactive Faerun map',
    'D&D map',
    'D&D 3.5 map',
    'Dungeons and Dragons map',
    'Sword Coast map',
    'Toril map',
    'Faerun city map',
];

/**
 * The flat map shown behind the canvas — see components/map/MapPoster.tsx.
 *
 * The alt text names regions because those are the words in the picture. It
 * must stay an honest description of what is visible; written past that, it is
 * keyword stuffing wearing an accessibility hat.
 */
export const POSTER_IMAGE = {
    url: '/faerun-map.webp',
    width: 1400,
    height: 936,
    alt:
        'Map of Faerûn from the Forgotten Realms, showing the Sword Coast, Waterdeep, '
        + 'Cormyr, the Moonsea, the Sea of Fallen Stars, Calimshan and Chult',
} as const;

/** The Open Graph and Twitter card. Both point at this one file. */
export const SOCIAL_IMAGE = {
    url: '/faerun-map-card.jpg',
    width: 1200,
    height: 630,
    alt: 'The interactive map of Faerûn — pan, zoom and measure the Forgotten Realms',
} as const;

/**
 * The X/Twitter account a card is attributed to, as twitter:site and
 * twitter:creator — the site's account and the author's are the same one here.
 *
 * X drops the attribution line entirely if the handle does not resolve, so a
 * stale one is no worse than none. It is still the first thing to change on a
 * fork: a card crediting someone else's account is the failure mode.
 */
export const TWITTER_HANDLE = '@nooikko';

/** en-GB is what the prose is written in — dates, "kilometres", "licence". */
export const SITE_LOCALE = 'en_GB';

/**
 * A complete Open Graph block for one page. Build every page's block through
 * this rather than spreading a partial override into it: a page declaring
 * `openGraph` replaces the layout's outright rather than merging, so a partial
 * one silently drops og:type, og:site_name and og:locale. Nothing warns.
 */
export function openGraphFor(path: string, title: string, description: string) {
    return {
        type: 'website' as const,
        siteName: SITE_NAME,
        locale: SITE_LOCALE,
        url: absoluteUrl(path),
        title,
        description,
        images: [SOCIAL_IMAGE],
    };
}
