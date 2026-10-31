// biome-ignore-all lint/a11y/useAnchorContent: The labeled link intentionally leaves the accessibility tree while its sidebar is closed.
import { PROJECT_NAME, REPO_URL } from '@/lib/attribution';

import styles from './GithubCorner.module.css';

interface GithubCornerProps {
    /** Layout — where the corner sits, and how it leaves. Owned by MapShell. */
    className?: string;
    /**
     * False while the sidebar is closed. The corner stays mounted so it can
     * slide out with the sidebar, so it has to be taken out of the tab order
     * explicitly — otherwise it is still reachable by keyboard once it is off
     * screen, and focus lands on something nobody can see.
     */
    reachable: boolean;
}

export function GithubCorner({ className, reachable }: GithubCornerProps) {
    const label = `${PROJECT_NAME} source on GitHub`;

    return (
        <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className={`${styles.corner}${className ? ` ${className}` : ''}`}
            aria-hidden={!reachable}
            inert={!reachable}
            tabIndex={reachable ? undefined : -1}
        >
            <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
                {/* Right angle at the bottom-left; hypotenuse runs back into the panel. */}
                <path className={styles.wedge} d="M0,0 L0,76 L76,76 Z" />
                {/*
                  * Anchored to the incenter, not the centroid. The mark reads as
                  * a circle, and the centroid of a right triangle sits high and
                  * wide of the point that is actually equidistant from all three
                  * edges — against the hypotenuse that difference is plain.
                  * Legs 76, so r = (76 + 76 - 76√2) / 2 = 22.26, putting the
                  * incenter at (22.26, 76 - 22.26). The 16px mark scales to 26,
                  * leaving ~9px clear on every side.
                  */}
                {/*
                  * Two nested groups, deliberately. Placement rides the SVG
                  * transform attribute; the hover nudge is a CSS transform on
                  * the child. Putting both on one element does not work — a CSS
                  * transform-origin re-anchors the attribute transform as well
                  * as the CSS one, which shifted the mark ~14px left and hung it
                  * off the panel edge. The child scales about `fill-box`, its
                  * own bounding box, rather than the shared view-box.
                  */}
                <g transform="translate(9.26,40.74) scale(1.625)">
                    <g className={styles.mark}>
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                    </g>
                </g>
            </svg>
        </a>
    );
}
