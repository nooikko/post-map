import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlacePanel } from '@/components/place/PlacePanel';
import { getPlace, placeMetadata, placeParams } from '@/lib/place/get';

import styles from './page.module.css';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
    return placeParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    return placeMetadata(slug);
}

/**
 * Standalone place page — what a shared link or a hard refresh renders.
 * The in-map experience is the intercepted modal at app/@modal/(.)place/[slug].
 */
export default async function PlacePage({ params }: PageProps) {
    const { slug } = await params;
    const place = await getPlace(slug);
    if (!place) notFound();

    return (
        <main className={styles.page}>
            <article className={styles.sheet}>
                <PlacePanel
                    marker={place.marker}
                    article={place.article}
                    dismiss={
                        <Link href="/" className={styles.back} aria-label="Back to the map">
                            ×
                        </Link>
                    }
                />
            </article>
        </main>
    );
}
