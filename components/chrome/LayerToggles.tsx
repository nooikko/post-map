'use client';

import { useEffect, useState } from 'react';

import { useMapCore } from '@/components/map/MapContext';
import { LAYERS, type LayerKey } from '@/lib/map/config';

import { SectionHeading } from './SectionHeading';

/** Sidebar checkbox list. Toggling flips the OpenLayers layer's visibility. */
export function LayerToggles() {
    const core = useMapCore();
    const [hidden, setHidden] = useState<ReadonlySet<LayerKey>>(new Set());

    // Re-apply visibility if the map is rebuilt (e.g. after a hot reload).
    useEffect(() => {
        if (!core) return;
        for (const def of LAYERS) {
            core.layers[def.key]?.layer.setVisible(!hidden.has(def.key));
        }
    }, [core, hidden]);

    function toggle(key: LayerKey) {
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    return (
        <div>
            <SectionHeading>Layers</SectionHeading>
            <div className="flex flex-col gap-1">
                {LAYERS.map((def) => (
                    <label
                        key={def.key}
                        className="grid cursor-pointer grid-cols-[18px_18px_1fr_auto] items-center gap-2.5 rounded px-1 py-1.5 select-none coarse:min-h-11 coarse:grid-cols-[22px_18px_1fr_auto] coarse:px-2 hover:bg-white/4"
                    >
                        <input
                            type="checkbox"
                            checked={!hidden.has(def.key)}
                            onChange={() => toggle(def.key)}
                            className="m-0 cursor-pointer accent-accent coarse:size-[18px]"
                        />
                        <span
                            aria-hidden="true"
                            className="inline-block justify-self-center rounded-full border border-black"
                            style={{
                                background: def.color,
                                width: def.radius * 2,
                                height: def.radius * 2,
                            }}
                        />
                        <span className="text-[13px] coarse:text-[15px]">{def.label}</span>
                        <span className="text-[11px] text-muted tabular-nums coarse:text-[13px]">
                            {core?.layers[def.key]?.count ?? 0}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
