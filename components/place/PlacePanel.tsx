import type { ReactNode } from 'react';

import { WIKI_NAME, articleUrl } from '@/lib/attribution';
import { layerByKey } from '@/lib/map/config';
import type { Marker } from '@/lib/markers/load';
import type { PlaceArticle } from '@/lib/wiki/types';

import { ArticleCredit } from './ArticleCredit';
import { InfoboxRail } from './InfoboxRail';
import styles from './PlacePanel.module.css';

interface PlacePanelProps {
    marker: Marker;
    article: PlaceArticle | null;
    /** Close affordance — a link on the standalone page, a button in the modal. */
    dismiss?: ReactNode;
}

/**
 * The place panel body, shared by the standalone route and the intercepted
 * modal so both render identical content — including the CC BY-SA credit,
 * which is a licence condition on every article view.
 */
export function PlacePanel({ marker, article, dismiss }: PlacePanelProps) {
    const layer = layerByKey(marker.category);

    return (
        <>
            <header className={styles.header}>
                <span className={styles.swatch} style={{ background: layer?.color, color: layer?.color }} />
                <span className={styles.heading}>
                    <span className={styles.name}>{marker.name}</span>
                    {article?.epithet && <span className={styles.subtitle}>{article.epithet}</span>}
                </span>
                <span className={styles.type}>{layer?.label ?? marker.category}</span>
                {dismiss}
            </header>

            <div className={styles.body}>
                <PlaceBody marker={marker} article={article} />
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
