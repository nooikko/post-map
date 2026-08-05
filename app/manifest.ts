import type { MetadataRoute } from 'next';

import { PROJECT_NAME } from '@/lib/attribution';
import { SITE_DESCRIPTION } from '@/lib/seo/site';

/**
 * The web app manifest, served at /manifest.webmanifest.
 *
 * Its presence is what emits <link rel="manifest"> — the file convention wires
 * that up, so layout.tsx names it nowhere. It is what lets Android offer "Add
 * to Home Screen" with a real name and icon instead of a URL and a screenshot.
 *
 * The icons are the two under public/ rather than app/icon.png, because a
 * manifest needs URLs that keep working: Next hashes the query string on
 * convention-based icons, and that hash moves whenever the file does. The
 * manifest is fetched and cached by the OS at install time, long after the
 * deployment that served it.
 *
 * Both files come out of `pnpm icons` — scripts/gen-icons.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        // `name` is the install prompt and the splash screen; `short_name` is
        // the label under the home screen icon, where anything past about 12
        // characters is truncated with an ellipsis.
        name: `${PROJECT_NAME} — Interactive Map of Faerûn`,
        short_name: PROJECT_NAME,
        description: SITE_DESCRIPTION,
        // Relative, so a fork on another origin needs no change here. `id` is
        // what the browser uses to tell an update from a second app, and
        // pinning it means the start URL can be changed later without the
        // installed copy being orphaned.
        id: '/',
        start_url: '/',
        scope: '/',
        // The map already fills the viewport and has its own controls; browser
        // chrome on top of it is a strip of nothing.
        display: 'standalone',
        // Matches --bg in app/globals.css, and the themeColor in layout.tsx.
        // The splash screen is that same near-black, so the launch does not
        // flash white before the map arrives.
        background_color: '#1a1a1a',
        theme_color: '#1a1a1a',
        lang: 'en-GB',
        orientation: 'any',
        categories: ['entertainment', 'games', 'reference'],
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // Android crops an "any" icon into whatever shape the launcher
            // uses, which would take the corners off the compass. The maskable
            // copy is drawn to the edges so there is something to crop.
            { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}
