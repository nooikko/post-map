import Link from 'next/link';

import {
    NON_AFFILIATION_NOTICE,
    PROJECT_NAME,
    REPO_URL,
    WIKI_HOST,
    WIKI_LICENSE,
    WIKI_NAME,
    WOTC_NOTICE,
} from '@/lib/attribution';

import styles from './Credits.module.css';
import { TopbarDialog } from './TopbarDialog';

interface CreditsProps {
    /** Layout on the topbar button. */
    className?: string;
}

/**
 * Site-wide credits, behind a button in the topbar. Covers the obligations
 * that aren't per-article: the WotC fan-content notice, which must appear
 * verbatim on pages showing their material, and where the tiles came from.
 *
 * The text is in the page's HTML on every page that shows the map, opened or
 * not: TopbarDialog renders its contents with the page rather than on a click.
 *
 * The per-article CC BY-SA credit lives in components/place/ArticleCredit.tsx.
 */
export function Credits({ className }: CreditsProps) {
    return (
        <TopbarDialog
            label="Credits"
            className={className}
            icon={
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <circle cx="8" cy="8" r="6.2" />
                    <path d="M8 7.3v3.9" />
                    <circle cx="8" cy="4.9" r="0.5" fill="currentColor" />
                </svg>
            }
        >
            <div className={styles.body}>
                <p>
                    Place articles come from the <Ext href={`https://${WIKI_HOST}/`}>{WIKI_NAME}</Ext>,
                    used under{' '}
                    <Ext href={WIKI_LICENSE.url} license>
                        {WIKI_LICENSE.label}
                    </Ext>
                    . Article text on this site is available under the same licence.
                </p>

                <p>
                    Map tiles were cut by this project from the published Faerûn map. The artwork
                    is Wizards of the Coast&rsquo;s.
                </p>

                {/* Required verbatim — set apart so it reads as a legal notice
                    rather than blurb, but keep it legible. */}
                <p className={styles.notice}>{WOTC_NOTICE}</p>

                <p>{NON_AFFILIATION_NOTICE}</p>

                {/* An internal route, so next/link rather than the Ext helper
                    below — nothing to open in a new tab and no rel to set. */}
                <p>
                    <Link href="/privacy">Privacy</Link> — what this site measures, and what it
                    does not.
                </p>

                <p>
                    <Ext href={REPO_URL}>{PROJECT_NAME} on GitHub</Ext> — the source, and where to
                    report a problem.
                </p>
            </div>
        </TopbarDialog>
    );
}

function Ext({
    href,
    license,
    children,
}: {
    href: string;
    license?: boolean;
    children: React.ReactNode;
}) {
    return (
        <a href={href} target="_blank" rel={license ? 'noopener noreferrer license' : 'noopener noreferrer'}>
            {children}
        </a>
    );
}
