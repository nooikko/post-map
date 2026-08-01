// Schema.org structured data — what a search engine is allowed to say about
// this site.
//
// Two rules govern every node below, and both are Google enforcement policy
// rather than taste. Nodes must describe content actually on the page; marking
// up what a visitor cannot see is penalised as spammy structured markup. And
// nothing here may describe a /place/ route, which would contradict the
// directives in app/robots.ts.

import {
    NON_AFFILIATION_NOTICE,
    PROJECT_NAME,
    REPO_URL,
    WOTC_POLICY_URL,
} from '@/lib/attribution';

import { absoluteUrl, POSTER_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site';

/** A JSON-LD node, loose enough to nest freely and specific enough to catch typos. */
export type JsonLdNode = Record<string, unknown>;

// Stable @ids so the nodes below can reference each other instead of repeating
// themselves. A crawler that sees the same @id twice knows it is one thing.
const WEBSITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#webapp`;
const IMAGE_ID = `${SITE_URL}/#map-image`;

/**
 * The map itself, as an image. Points at the poster in
 * components/map/MapPoster.tsx, which is what makes it findable at all.
 *
 * `creditText`, `copyrightNotice` and `license` are Google's image licence
 * fields. All three name Wizards of the Coast, so an image result carrying this
 * map says whose map it is without anyone having to reach the page.
 */
function mapImageNode(): JsonLdNode {
    return {
        '@type': 'ImageObject',
        '@id': IMAGE_ID,
        url: absoluteUrl(POSTER_IMAGE.url),
        contentUrl: absoluteUrl(POSTER_IMAGE.url),
        width: POSTER_IMAGE.width,
        height: POSTER_IMAGE.height,
        name: 'Map of Faerûn',
        caption: POSTER_IMAGE.alt,
        description:
            'The continent of Faerûn in the Forgotten Realms, from the Dungeons & Dragons '
            + '3rd-edition poster map, shown here as a zoomable tiled map.',
        representativeOfPage: true,
        creditText: 'Wizards of the Coast',
        copyrightNotice: '© Wizards of the Coast LLC',
        license: WOTC_POLICY_URL,
        acquireLicensePage: WOTC_POLICY_URL,
    };
}

/**
 * The site itself. `alternateName` is where the brand goes: someone searching
 * "post map faerun" and someone searching "map of faerun" should both land,
 * and only one of those is the name.
 */
export function websiteNode(): JsonLdNode {
    return {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        alternateName: 'Post Map — Faerûn',
        description: SITE_DESCRIPTION,
        inLanguage: 'en-GB',
    };
}

/**
 * The map, as a thing you use rather than a page you read.
 *
 * `isAccessibleForFree` and the zero-price Offer are read together; stating
 * only one leaves "is this paywalled?" open. Free access is a Fan Content
 * Policy condition (lib/attribution.ts), so this states an obligation.
 */
export function webApplicationNode(placeCount: number): JsonLdNode {
    return {
        '@type': 'WebApplication',
        '@id': APP_ID,
        url: `${SITE_URL}/`,
        name: PROJECT_NAME,
        description: SITE_DESCRIPTION,
        applicationCategory: 'ReferenceApplication',
        applicationSubCategory: 'Interactive map',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        inLanguage: 'en-GB',
        isPartOf: { '@id': WEBSITE_ID },
        image: { '@id': IMAGE_ID },
        primaryImageOfPage: { '@id': IMAGE_ID },
        featureList: [
            'Pan and zoom a tiled map of Faerûn',
            `Search ${placeCount} marked places`,
            'Toggle capitals, cities, ports, fortresses, ruins, sites and temples',
            'Measure travel distance in miles or kilometres',
            'A shareable link for every place',
        ],
        about: [
            { '@type': 'Thing', name: 'Faerûn' },
            { '@type': 'Thing', name: 'Forgotten Realms' },
            { '@type': 'Thing', name: 'Dungeons & Dragons 3.5 edition' },
        ],
        // A rich result that read as official would be the confusion the Fan
        // Content Policy exists to prevent, so the notice goes in the
        // machine-readable copy too.
        disambiguatingDescription: NON_AFFILIATION_NOTICE,
        codeRepository: REPO_URL,
    };
}

/**
 * Everything the map page declares about itself, as one @graph document — one
 * script tag, one parse, cross-references between the nodes intact.
 */
export function homeGraph(placeCount: number): JsonLdNode {
    return {
        '@context': 'https://schema.org',
        '@graph': [websiteNode(), webApplicationNode(placeCount), mapImageNode()],
    };
}
