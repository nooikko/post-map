import type { MetadataRoute } from 'next';

/**
 * The map is indexable; the place articles are not.
 *
 * Post Map is not a mirror of the Forgotten Realms Wiki and should not compete
 * with it in search results — duplicating their article text is the specific
 * thing the wiki community has objected to in earlier mirrors. This pairs with
 * the per-page `robots: { index: false }` in lib/place/get.ts; the meta tag
 * covers pages a crawler reaches by other means.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/place/',
        },
    };
}
