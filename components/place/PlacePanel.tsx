import type { ReactNode } from 'react';

import { WIKI_NAME, articleUrl } from '@/lib/attribution';
import { layerByKey } from '@/lib/map/config';
import type { Place } from '@/lib/place/get';
import type { Marker } from '@/lib/markers/load';
import type { PlaceArticle } from '@/lib/wiki/types';

import { ArticleCredit } from './ArticleCredit';
import { InfoboxRail } from './InfoboxRail';
import { NearbyPlaces, type PlaceLinkMode } from './NearbyPlaces';
import styles from './PlacePanel.module.css';

interface PlacePanelProps {
    place: Place;
    /**
     * h1 on the standalone page, where the place is what the page is about; h2
     * in the modal, which sits under the map page's own h1.
     */
    headingLevel: 1 | 2;
    linkMode: PlaceLinkMode;
    /** Close affordance — a link on the standalone page, a button in the modal. */
    dismiss?: ReactNode;
}

/**
 * The place panel body, shared by the standalone route and the intercepted
 * modal so both render identical content — including the CC BY-SA credit,
 * which is a licence condition on every article view.
 */
export function PlacePanel({ place, headingLevel, linkMode, dismiss }: PlacePanelProps) {
    const { marker, article, nearby } = place;
    const layer = layerByKey(marker.category);
    const Name = headingLevel === 1 ? 'h1' : 'h2';

    return (
        <>
            <header className={styles.header}>
                <span className={styles.swatch} style={{ background: layer?.color, color: layer?.color }} />
                <div className={styles.heading}>
                    <Name className={styles.name}>{marker.name}</Name>
                    {article?.epithet && <span className={styles.subtitle}>{article.epithet}</span>}
                </div>
                <span className={styles.type}>{layer?.label ?? marker.category}</span>
                {dismiss}
            </header>

            <div className={styles.body}>
                <PlaceBody marker={marker} article={article} />
                <NearbyPlaces
                    places={nearby}
                    linkMode={linkMode}
                    headingLevel={headingLevel === 1 ? 2 : 3}
                />
            </div>
        </>
    );
}

function PlaceBody({ marker, article }: { marker: Marker; article: PlaceArticle | null }) {
    if (!article) {
        // No wiki text is used, so no CC BY-SA credit is rendered here.
        return (
            <div className={styles.status}>
                <span>No archive entry for this place.</span>
                <span className={styles.muted}>
                    It may exist on the {WIKI_NAME} under another name.
                </span>
            </div>
        );
    }

    if (article.redirectTo) {
        return (
            <>
                <div className={styles.redirect}>
                    <p>
                        No separate archive entry for <strong>{marker.name}</strong>.
                    </p>
                    <p className={styles.mutedLine}>
                        Recorded in the lore as{' '}
                        <a
                            href={articleUrl(article.redirectTo)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <strong>{article.redirectTo}</strong>
                        </a>
                        .
                    </p>
                </div>
                <ArticleCredit meta={article.meta} />
            </>
        );
    }

    const hasRail = article.groups.length > 0;

    return (
        <>
            <div className={`${styles.grid} ${hasRail ? styles.hasRail : ''}`}>
                <article className={styles.prose}>
                    {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Mirrored article markup is required here; its sanitization contract is in lib/wiki/sanitize.ts. */}
                    <div dangerouslySetInnerHTML={{ __html: article.proseHtml }} />
                </article>
                {hasRail && <InfoboxRail groups={article.groups} />}
            </div>
            <ArticleCredit meta={article.meta} />
        </>
    );
}
