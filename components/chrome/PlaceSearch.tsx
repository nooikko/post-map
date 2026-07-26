'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';

import { useMapCore } from '@/components/map/MapContext';
import { layerByKey } from '@/lib/map/config';
import { clampCenter, pixelToCoord, type Coord } from '@/lib/map/geometry';
import type { Marker } from '@/lib/markers/load';

import { SectionHeading } from './SectionHeading';

const MAX_RESULTS = 30;

interface PlaceSearchProps {
    markers: Marker[];
    onSelect: (slug: string) => void;
}

/**
 * Case-insensitive substring search over every marker name. Selecting a result
 * flies the view to it, then opens its place route.
 */
export function PlaceSearch({ markers, onSelect }: PlaceSearchProps) {
    const core = useMapCore();
    const [query, setQuery] = useState('');

    const sorted = useMemo(
        () => [...markers].sort((a, b) => a.name.localeCompare(b.name)),
        [markers],
    );

    const needle = query.trim().toLowerCase();

    const matches = useMemo(() => {
        if (!needle) return [];
        const out: Marker[] = [];
        for (const marker of sorted) {
            if (!marker.name.toLowerCase().includes(needle)) continue;
            out.push(marker);
            if (out.length > MAX_RESULTS) break;
        }
        return out;
    }, [sorted, needle]);

    function go(marker: Marker) {
        setQuery('');
        flyTo(core, marker);
        onSelect(marker.slug);
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape') setQuery('');
        if (e.key === 'Enter' && matches.length > 0) go(matches[0]);
    }

    const shown = matches.slice(0, MAX_RESULTS);

    return (
        <div>
            <SectionHeading>Search</SectionHeading>
            <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                autoComplete="off"
                spellCheck={false}
                placeholder={`Type a place name… (${markers.length} known)`}
                className="w-full rounded-[5px] border border-edge bg-white/4 px-2.5 py-2 text-[13px] text-panel-fg outline-none placeholder:text-muted focus:border-accent focus:bg-accent/6"
            />

            {needle && (
                <ul className="mt-1.5 max-h-70 list-none overflow-y-auto rounded-[5px] border border-edge bg-black/20 p-0">
                    {shown.length === 0 && (
                        <li className="px-3 py-2.5 text-[12px] text-muted italic">No matches</li>
                    )}
                    {shown.map((marker) => (
                        <li key={marker.slug}>
                            <button
                                type="button"
                                onClick={() => go(marker)}
                                className="grid w-full cursor-pointer grid-cols-[14px_1fr_auto] items-center gap-2 border-b border-white/3 px-2.5 py-[7px] text-left text-[13px] last:border-b-0 hover:bg-accent/12"
                            >
                                <span
                                    aria-hidden="true"
                                    className="size-2 justify-self-center rounded-full border border-black"
                                    style={{ background: layerByKey(marker.category)?.color }}
                                />
                                <span>
                                    <Highlighted name={marker.name} needle={needle} />
                                </span>
                                <span className="text-[10px] tracking-[0.4px] text-muted uppercase">
                                    {layerByKey(marker.category)?.label}
                                </span>
                            </button>
                        </li>
                    ))}
                    {matches.length > MAX_RESULTS && (
                        <li className="px-3 py-2.5 text-[12px] text-muted italic">
                            …and more — refine your query
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

/** Marks the matched substring. Built from text nodes, so no HTML escaping needed. */
function Highlighted({ name, needle }: { name: string; needle: string }) {
    const i = name.toLowerCase().indexOf(needle);
    if (i < 0) return <>{name}</>;
    return (
        <>
            {name.slice(0, i)}
            <mark className="rounded-[2px] bg-[#f5a623]/30 px-px text-[#f5a623]">
                {name.slice(i, i + needle.length)}
            </mark>
            {name.slice(i + needle.length)}
        </>
    );
}

function flyTo(core: ReturnType<typeof useMapCore>, marker: Marker): void {
    if (!core) return;
    const view = core.map.getView();
    const coord = pixelToCoord(marker.x, marker.y);
    const targetZoom = Math.max(view.getZoom() ?? 4, 4);

    // Clamp at the destination resolution so an edge feature lands flush
    // against the viewport edge instead of centering (which would show
    // background past the map, then snap back on moveend).
    const size = core.map.getSize();
    const targetRes = view.getResolutionForZoom(targetZoom);
    const target: Coord = size ? clampCenter(coord, targetRes, size as [number, number]) : coord;

    view.animate({ center: target, zoom: targetZoom, duration: 700 });
}
