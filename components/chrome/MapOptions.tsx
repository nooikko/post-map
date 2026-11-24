'use client';

import { useId } from 'react';

import type { MapVersion } from '@/lib/map/config';
import { setMapVersion, useMapVersion } from '@/lib/settings/mapVersion';

import styles from './MapOptions.module.css';
import { TopbarDialog } from './TopbarDialog';

interface VersionChoice {
    value: MapVersion;
    name: string;
    /** Shown beside the name of the one the map opens with. */
    note?: string;
    description: string;
}

/** The edition this map belongs to; the heading its versions sit under. */
const EDITION = '3rd Edition';

/**
 * What each version is, for someone choosing between them — not how it was
 * made. The method is docs/tile-pipeline.md's to record.
 */
const VERSIONS: readonly VersionChoice[] = [
    {
        value: 'enhanced',
        name: 'Enhanced',
        note: 'Recommended',
        description:
            'Cleaned up and smoothed for close viewing, so lettering and linework stay sharp when you zoom all the way in.',
    },
    {
        value: 'original',
        name: 'Original',
        description:
            'The map as Wizards of the Coast released it, with compression artifacts removed and nothing else changed.',
    },
];

interface MapOptionsProps {
    /** Layout on the topbar button. */
    className?: string;
}

/**
 * Which version of the map is drawn.
 *
 * A dialog rather than a control in the sidebar because each choice needs a
 * sentence to mean anything, and the sidebar is where the short, glanceable
 * controls live.
 *
 * A choice applies at once — the map redraws behind the dialog — so there is
 * nothing to confirm and the footer button only closes.
 */
export function MapOptions({ className }: MapOptionsProps) {
    const version = useMapVersion();
    const groupName = useId();
    const groupId = useId();

    return (
        <TopbarDialog
            label="Map options"
            done="Done"
            className={className}
            icon={
                // Three sliders: options, as distinct from the panel toggle's three plain bars.
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M2 4h5.5M11 4h3M2 8h2M7.5 8H14M2 12h7M12.5 12H14" />
                    <circle cx="9.25" cy="4" r="1.6" />
                    <circle cx="5.75" cy="8" r="1.6" />
                    <circle cx="10.75" cy="12" r="1.6" />
                </svg>
            }
        >
            {/*
              * One group per map, headed by the edition it belongs to, so that
              * maps from other editions can be added as further groups under
              * the same dialog.
              *
              * A labelled radiogroup rather than fieldset/legend: a legend is
              * laid out on the fieldset's border by the browser, which ignores
              * the padding and gap the rest of this panel uses.
              */}
            <div role="radiogroup" aria-labelledby={groupId} className={styles.group}>
                <h3 id={groupId} className={styles.legend}>
                    {EDITION}
                </h3>
                {VERSIONS.map((choice) => (
                    <label key={choice.value} className={styles.choice}>
                        <input
                            type="radio"
                            name={groupName}
                            value={choice.value}
                            checked={version === choice.value}
                            onChange={() => setMapVersion(choice.value)}
                            className={styles.radio}
                        />
                        <span className={styles.text}>
                            <span className={styles.name}>
                                {choice.name}
                                {choice.note && <span className={styles.note}>{choice.note}</span>}
                            </span>
                            <span className={styles.description}>{choice.description}</span>
                        </span>
                    </label>
                ))}
            </div>
        </TopbarDialog>
    );
}
