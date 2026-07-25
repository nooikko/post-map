import {
    WIKI_LICENSE,
    WIKI_NAME,
    articleUrl,
    modificationNotice,
} from '@/lib/attribution';
import type { ArticleMeta } from '@/lib/wiki/types';

import styles from './ArticleCredit.module.css';

interface ArticleCreditProps {
    meta: ArticleMeta;
}

/**
 * Per-article CC BY-SA attribution.
 *
 * This is a licence condition, not a footer decoration: it must render on
 * EVERY view of an article. Both the standalone page and the intercepted modal
 * render this same component precisely so the two cannot drift apart — do not
 * inline a copy of it in either route.
 *
 */
export function ArticleCredit({ meta }: ArticleCreditProps) {
    const page = meta.title || meta.name;

    return (
        <footer className={styles.credit}>
            <span className={styles.line}>
                From{' '}
                <a href={articleUrl(meta.name)} target="_blank" rel="noopener noreferrer">
                    {page}
                </a>{' '}
                on the {WIKI_NAME}, licensed under{' '}
                <a href={WIKI_LICENSE.url} target="_blank" rel="noopener noreferrer license">
                    {WIKI_LICENSE.label}
                </a>
                .
            </span>
            <span className={styles.stamp}>{modificationNotice(meta.fetchedAt)}</span>
        </footer>
    );
}
