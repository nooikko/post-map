import { IMG_H, IMG_W, METERS_PER_PIXEL } from '@/lib/map/config';
import { METERS_PER_MILE } from '@/lib/map/geometry';

interface AboutMapProps {
    /** Marker count, passed down from the build-time read rather than hardcoded. */
    placeCount: number;
}

const roughly = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** To the nearest hundred, in both units: "3,800 miles (6,100 km)". */
function span(pixels: number): string {
    const meters = pixels * METERS_PER_PIXEL;
    const hundred = (n: number) => roughly.format(Math.round(n / 100) * 100);
    return `${hundred(meters / METERS_PER_MILE)} miles (${hundred(meters / 1000)} km)`;
}

/**
 * The body copy of the map page: what this is, in the server-rendered HTML
 * where a reader and a crawler both meet it. Everything around it is a canvas
 * that exists only after hydration.
 *
 * Every sentence states something about this map that the map's own data
 * backs: what it was cut from, how many places it marks, and how big it is at
 * the scale the ruler measures against. It must not grow into lore — the offer
 * is the map, and the lore belongs to the wiki Credits links.
 */
export function AboutMap({ placeCount }: AboutMapProps) {
    return (
        <section className="border-t border-edge pt-4">
            <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.8px] text-muted uppercase">
                About this map
            </h2>

            <p className="mb-2 text-[11.5px] leading-relaxed text-muted coarse:text-[13px]">
                The whole of Faerûn — the continent the Forgotten Realms are set on — cut
                from the Dungeons &amp; Dragons 3rd-edition poster map into tiles you can
                pan and zoom, with {placeCount} places marked on it.
            </p>

            <p className="text-[11.5px] leading-relaxed text-muted coarse:text-[13px]">
                At the map&rsquo;s scale it runs about {span(IMG_W)} from east to west and{' '}
                {span(IMG_H)} from north to south. The ruler measures against that same
                scale, in miles or kilometres.
            </p>
        </section>
    );
}
