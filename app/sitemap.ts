import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo/site';

/**
 * The pages this site wants indexed — deliberately not the place routes, which
 * app/robots.ts disallows.
 *
 * No `lastModified`: it could only come from the build clock, and a timestamp
 * that moves on every deploy tells a crawler the page changed when it did not.
 * It is the one field Google acts on, so saying nothing beats saying something
 * false.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
        { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.3 },
    ];
}
