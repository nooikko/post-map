import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ModalCloseButton, PlaceModal } from '@/components/place/PlaceModal';
import { PlacePanel } from '@/components/place/PlacePanel';
import { getPlace, placeMetadata, placeParams } from '@/lib/place/get';

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
 * Intercepted place route: renders over the map when a marker is clicked,
 * leaving the map mounted underneath because the `children` segment never
 * changes. A cold load or refresh of the same URL falls through to
 * app/place/[slug]/page.tsx instead.
 *
 * Both routes render PlacePanel, so the CC BY-SA credit cannot appear in one
 * view and not the other.
 */
export default async function PlaceModalPage({ params }: PageProps) {
    const { slug } = await params;
    const place = await getPlace(slug);
    if (!place) notFound();

    return (
        <PlaceModal>
            <PlacePanel
                marker={place.marker}
                article={place.article}
                dismiss={<ModalCloseButton />}
            />
        </PlaceModal>
    );
}
