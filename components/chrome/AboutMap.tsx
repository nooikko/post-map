interface AboutMapProps {
    /** Marker count, passed down from the build-time read rather than hardcoded. */
    placeCount: number;
}

/**
 * The body copy of the map page: the one sentence saying what this is, in the
 * server-rendered HTML where a reader and a crawler both meet it. Everything
 * around it is a canvas that exists only after hydration.
 *
 * Keep it to a sentence. The controls above and Credits below already cover the
 * categories, the ruler, and where the articles come from, so anything
 * restating those is length without content. It must never grow into an
 * encyclopaedia entry — the offer is the map, and the lore belongs to the wiki
 * Credits links.
 */
export function AboutMap({ placeCount }: AboutMapProps) {
    return (
        <section className="border-t border-edge pt-4">
            <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.8px] text-muted uppercase">
                About this map
            </h2>

            <p className="text-[11.5px] leading-relaxed text-muted coarse:text-[13px]">
                The whole of Faerûn — the continent the Forgotten Realms are set on — cut
                from the Dungeons &amp; Dragons 3rd-edition poster map into tiles you can
                pan and zoom, with {placeCount} places marked on it.
            </p>
        </section>
    );
}
