import { POSTER_IMAGE } from '@/lib/seo/site';

import styles from './MapShell.module.css';

/**
 * A flat picture of the whole map, behind the OpenLayers canvas.
 *
 * Everything OpenLayers draws lives in a <canvas>, which is invisible to image
 * search and to a screen reader. This is the same map as a real <img> with a
 * stable URL and honest alt text — the only description of it in the document,
 * which is why `aria-hidden` would be wrong here. It is also what fills the
 * container until the tiles arrive.
 *
 * A plain <img> rather than next/image on purpose: the file is already a
 * hand-tuned WebP (scripts/gen-map-images.mjs), and the optimiser would trade a
 * permanent URL for a query-string /_next/image one — worse to rank, worse to
 * link to.
 */
export function MapPoster() {
    return (
        // The wrapper is what carries the map's insets; the image fills it.
        // See the note on `.poster` in MapShell.module.css for why an <img>
        // cannot take those insets directly.
        <div className={styles.poster}>
            <img
                src={POSTER_IMAGE.url}
                width={POSTER_IMAGE.width}
                height={POSTER_IMAGE.height}
                alt={POSTER_IMAGE.alt}
                // Eager because it *is* the fold, but no `fetchPriority` —
                // the tiles that replace it must not queue behind it.
                loading="eager"
                decoding="async"
                draggable={false}
                className={styles.posterImage}
            />
        </div>
    );
}
