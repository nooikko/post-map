import {
    NON_AFFILIATION_NOTICE,
    TILE_SOURCE,
    WIKI_HOST,
    WIKI_LICENSE,
    WIKI_NAME,
    WOTC_NOTICE,
} from '@/lib/attribution';

import { SectionHeading } from './SectionHeading';

/**
 * Site-wide credits. Covers the two obligations that aren't per-article: the
 * WotC fan-content notice (which must appear verbatim on pages showing their
 * material) and tile provenance.
 *
 * The per-article CC BY-SA credit lives in components/place/ArticleCredit.tsx.
 */
export function Credits() {
    return (
        <div className="border-t border-edge pt-4">
            <SectionHeading>Credits &amp; licence</SectionHeading>

            <p className="mb-2 text-[11px] leading-relaxed text-muted">
                Place articles come from the{' '}
                <Ext href={`https://${WIKI_HOST}/`}>{WIKI_NAME}</Ext>, used under{' '}
                <Ext href={WIKI_LICENSE.url} license>
                    {WIKI_LICENSE.label}
                </Ext>
                . Article text on this site is available under the same licence.
            </p>

            <p className="mb-2 text-[11px] leading-relaxed text-muted">
                Map tiles derived from <Ext href={TILE_SOURCE.url}>{TILE_SOURCE.label}</Ext>.
            </p>

            {/* Required verbatim — set apart so it reads as a legal notice
                rather than blurb, but keep it legible. */}
            <p className="mb-2 rounded-[2px] border-l-2 border-gold-line bg-white/3 px-2.5 py-2 text-[10.5px] leading-relaxed text-[#7f7f7f]">
                {WOTC_NOTICE}
            </p>

            <p className="text-[11px] leading-relaxed text-muted">{NON_AFFILIATION_NOTICE}</p>
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
