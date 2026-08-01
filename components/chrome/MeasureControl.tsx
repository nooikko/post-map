'use client';

import { setUnit, useUnit, type DistanceUnit } from '@/lib/settings/units';

import { SectionHeading } from './SectionHeading';

const UNITS: Array<{ value: DistanceUnit; label: string }> = [
    { value: 'mi', label: 'Miles' },
    { value: 'km', label: 'Kilometres' },
];

/**
 * Measurement settings.
 *
 * The tool's own controls are on the map, not here: the toggle sits with the
 * zoom buttons in the bottom-right (components/map/MeasureToggle.tsx) and Clear
 * is attached to the distance readout (components/map/MeasureReadout.tsx). What
 * stays in the sidebar is the preference that outlives any one measurement.
 *
 * useMeasureTool is deliberately NOT called here. It owns OpenLayers
 * interactions and overlays and must be instantiated exactly once, which
 * MapShell now does.
 */
export function MeasureControl() {
    const unit = useUnit();

    return (
        <div>
            <SectionHeading>Measurement</SectionHeading>

            <label className="flex items-center justify-between gap-2 px-1 text-[12px] text-muted coarse:min-h-11 coarse:px-2 coarse:text-[14px]">
                <span>Units</span>
                <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as DistanceUnit)}
                    className="cursor-pointer rounded border border-edge bg-white/4 px-1.5 py-1 text-[12px] text-panel-fg outline-none coarse:min-h-9 coarse:px-2.5 coarse:text-[15px] focus:border-accent"
                >
                    {UNITS.map((u) => (
                        <option key={u.value} value={u.value} className="bg-[#1f1f1f]">
                            {u.label}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}
