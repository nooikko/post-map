import type { MetadataRoute } from 'next';

import { absoluteUrl, SITE_URL } from '@/lib/seo/site';

/**
 * The map is indexable; the place articles are not.
 *
 * Post Map is not a mirror of the Forgotten Realms Wiki and should not compete
 * with it in search results — duplicating their article text is the specific
 * thing the wiki community has objected to in earlier mirrors.
 *
 * Two straps, doing different jobs. `Disallow` stops the crawl, so the article
 * text is never fetched and can never be ranked on. Its gap is that a
 * disallowed URL can still be listed without a snippet if something external
 * links to it, which the `robots: { index: false }` in lib/place/get.ts closes
 * for any crawler that reaches the page another way.
 *
 * `/tiles/` must stay crawlable: Googlebot renders the page to judge it, and a
 * map whose tiles it may not fetch renders as an empty box.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/place/',
        },
        sitemap: absoluteUrl('/sitemap.xml'),
        host: SITE_URL,
    };
}
