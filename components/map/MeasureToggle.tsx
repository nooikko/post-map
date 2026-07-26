'use client';

import { useMeasureStore } from './measureStore';
import styles from './MeasureToggle.module.css';

interface MeasureToggleProps {
    onToggle: () => void;
}

/**
 * Measure tool toggle, sitting with the zoom control in the bottom-right rather
 * than in the sidebar.
 *
 * The tool itself lives in useMeasureTool, which owns OpenLayers interactions
 * and overlays and must therefore be instantiated exactly once — MapShell does
 * that and passes the toggle down. This component only reflects and flips
 * state; clearing lives on the readout, next to the distance it clears.
 */
export function MeasureToggle({ onToggle }: MeasureToggleProps) {
    const { active } = useMeasureStore();

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={active}
            title={active ? 'Stop measuring' : 'Measure distance'}
            className={`${styles.toggle} ${active ? styles.active : ''}`}
        >
            <span aria-hidden="true">📏</span>
            <span className="sr-only">{active ? 'Stop measuring' : 'Measure distance'}</span>
        </button>
    );
}
