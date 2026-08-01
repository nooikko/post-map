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

import { SectionHeading } from './SectionHeading';

/**
 * Site-wide credits. Covers the obligations that aren't per-article: the WotC
 * fan-content notice, which must appear verbatim on pages showing their
 * material, and where the tiles came from.
 *
 * The per-article CC BY-SA credit lives in components/place/ArticleCredit.tsx.
 */
export function Credits() {
    return (
        <div className="border-t border-edge pt-4">
            <SectionHeading>Credits &amp; licence</SectionHeading>

            <p className="mb-2 text-[11px] leading-relaxed text-muted coarse:text-[13px]">
                Place articles come from the{' '}
                <Ext href={`https://${WIKI_HOST}/`}>{WIKI_NAME}</Ext>, used under{' '}
                <Ext href={WIKI_LICENSE.url} license>
                    {WIKI_LICENSE.label}
                </Ext>
                . Article text on this site is available under the same licence.
            </p>

            <p className="mb-2 text-[11px] leading-relaxed text-muted coarse:text-[13px]">
                Map tiles were cut by this project from the published Faerûn map. The
                artwork is Wizards of the Coast&rsquo;s.
            </p>

            {/* Required verbatim — set apart so it reads as a legal notice
                rather than blurb, but keep it legible. */}
            <p className="mb-2 rounded-[2px] border-l-2 border-gold-line bg-white/3 px-2.5 py-2 text-[10.5px] leading-relaxed text-[#7f7f7f] coarse:text-[12.5px]">
                {WOTC_NOTICE}
            </p>

            <p className="mb-2 text-[11px] leading-relaxed text-muted coarse:text-[13px]">
                {NON_AFFILIATION_NOTICE}
            </p>

            {/* An internal route, so next/link rather than the Ext helper
                below — nothing to open in a new tab and no rel to set. */}
            <p className="mb-2 text-[11px] leading-relaxed text-muted coarse:text-[13px]">
                <Link href="/privacy" className="text-accent no-underline hover:underline">
                    Privacy
                </Link>{' '}
                — what this site measures, and what it does not.
            </p>

            {/*
              * The touch half of the repo link. Desktop has the GitHub corner;
              * touch has no corner and the topbar icon goes when the drawer
              * opens, so without this there is no way to the repository while
              * the drawer is up — and the drawer is a modal <dialog>, so an
              * icon left in the bar behind it would be inert anyway.
              *
              * Switched on the same @media (pointer: coarse) that hides
              * `.corner` in MapShell.module.css, so the two are complementary
              * by construction. A flag from MapShell's pointer hook would also
              * land a frame after hydration and pop the line in.
              */}
            <p className="hidden text-[11px] leading-relaxed text-muted coarse:block coarse:text-[13px]">
                <Ext href={REPO_URL}>{PROJECT_NAME} on GitHub</Ext> — the source, and
                where to report a problem.
            </p>
        </div>
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
        <a
            href={href}
            target="_blank"
            rel={license ? 'noopener noreferrer license' : 'noopener noreferrer'}
            className="text-accent no-underline hover:underline"
        >
            {children}
        </a>
    );
}
