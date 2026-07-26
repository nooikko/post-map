'use client';

import { useMeasureStore } from './measureStore';
import styles from './MeasureReadout.module.css';

interface MeasureReadoutProps {
    onClear: () => void;
}

/**
 * The running distance total, with Clear attached to it.
 *
 * Clear used to sit in the sidebar under the measure button, far from the
 * number it resets and visible even when there was nothing to clear. Here it
 * appears only while a measurement exists, right beside it.
 */
export function MeasureReadout({ onClear }: MeasureReadoutProps) {
    const { readout } = useMeasureStore();

    if (!readout) return null;

    return (
        <div className={styles.readout} role="status" aria-live="polite">
            <span className={styles.distance}>{readout}</span>
            <button type="button" onClick={onClear} className={styles.clear}>
                Clear
            </button>
        </div>
    );
}
