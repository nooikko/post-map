// biome-ignore-all lint/suspicious/noArrayIndexKey: These stateless lists render immutable article snapshots whose repeated values have no source IDs.
import type { InfoboxField, InfoboxGroup } from '@/lib/wiki/types';

import styles from './InfoboxRail.module.css';

interface InfoboxRailProps {
    groups: InfoboxGroup[];
}

/** Fandom's portable-infobox, re-rendered as our own stat rail. */
export function InfoboxRail({ groups }: InfoboxRailProps) {
    return (
        <aside className={styles.rail}>
            {groups.map((group, i) => (
                <section key={group.heading ?? `group-${i}`} className={styles.group}>
                    {group.heading && <h3 className={styles.heading}>{group.heading}</h3>}
                    {group.fields.map((field) => (
                        <Field key={`${field.source}-${field.label}`} field={field} />
                    ))}
                </section>
            ))}
        </aside>
    );
}

function Field({ field }: { field: InfoboxField }) {
    return (
        <div className={styles.field}>
            <div className={styles.label}>{field.label}</div>
            <div className={styles.value}>
                <FieldValue field={field} />
            </div>
        </div>
    );
}

function FieldValue({ field }: { field: InfoboxField }) {
    switch (field.kind) {
        case 'bars':
            return (
                <>
                    {field.parts.map((part, index) => (
                        <div key={index}>
                            {part.kind === 'text' ? (
                                <div className={styles.line}>{part.text}</div>
                            ) : part.rows.map((row) => (
                                <div key={row.name} className={styles.bar}>
                                    <span className={styles.barName}>{row.name}</span>
                                    <span className={styles.barTrack}>
                                        <span
                                            className={styles.barFill}
                                            style={{ width: `${clampPct(row.pct)}%` }}
                                        />
                                    </span>
                                    <span className={styles.barPct}>{row.label}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </>
            );

        case 'lines':
            return (
                <>
                    {field.lines.map((line, i) => (
                        <div key={`${line}-${i}`} className={styles.line}>
                            {line}
                        </div>
                    ))}
                </>
            );

        case 'chips':
            return (
                <>
                    {field.chips.map((chip, i) => (
                        <span key={`${chip}-${i}`} className={styles.chip}>
                            {chip}
                        </span>
                    ))}
                </>
            );

        case 'text':
            return <>{field.text}</>;
    }
}

function clampPct(pct: number | null): number {
    if (pct === null || !Number.isFinite(pct)) return 0;
    return Math.min(100, Math.max(0, pct));
}
