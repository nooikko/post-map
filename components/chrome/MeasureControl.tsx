'use client';

import { useMapCore } from '@/components/map/MapContext';
import { useMeasureStore } from '@/components/map/measureStore';
import { useMeasureTool } from '@/components/map/useMeasureTool';
import { setUnit, useUnit, type DistanceUnit } from '@/lib/settings/units';

import { SectionHeading } from './SectionHeading';

const UNITS: Array<{ value: DistanceUnit; label: string }> = [
    { value: 'mi', label: 'Miles' },
    { value: 'km', label: 'Kilometres' },
];

export function MeasureControl() {
    const core = useMapCore();
    const { toggle, clear } = useMeasureTool(core);
    const { active, readout } = useMeasureStore();
    const unit = useUnit();

    return (
        <div>
            <SectionHeading>Tools</SectionHeading>

            <button
                type="button"
                onClick={toggle}
                aria-pressed={active}
                className={`mb-1.5 flex w-full cursor-pointer items-center gap-2 rounded-[5px] border px-2.5 py-2 text-left text-[13px] ${
                    active
                        ? 'border-accent bg-accent/18 text-white'
                        : 'border-edge bg-white/4 text-panel-fg hover:bg-white/8'
                }`}
            >
                <span className="text-[15px]">📏</span>
                <span>Measure distance</span>
            </button>

            <button
                type="button"
                onClick={clear}
                className="mb-1.5 flex w-full cursor-pointer items-center rounded-[5px] border border-transparent px-2.5 py-1 text-left text-[12px] text-muted hover:text-panel-fg"
            >
                Clear
            </button>

            <label className="mt-1 flex items-center justify-between gap-2 px-1 text-[12px] text-muted">
                <span>Units</span>
                <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as DistanceUnit)}
                    className="cursor-pointer rounded border border-edge bg-white/4 px-1.5 py-1 text-[12px] text-panel-fg outline-none focus:border-accent"
                >
                    {UNITS.map((u) => (
                        <option key={u.value} value={u.value} className="bg-[#1f1f1f]">
                            {u.label}
                        </option>
                    ))}
                </select>
            </label>

            {readout && (
                <div className="pointer-events-none fixed bottom-6 left-1/2 z-600 -translate-x-1/2 rounded-md border border-edge bg-[#141414]/94 px-3.5 py-2 text-[13px] text-panel-fg shadow-[0_6px_20px_rgba(0,0,0,0.4)] tabular-nums">
                    {readout}
                </div>
            )}
        </div>
    );
}
