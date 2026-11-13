'use client';

import { useId, useRef, type ReactNode } from 'react';

import styles from './TopbarDialog.module.css';

interface TopbarDialogProps {
    /** The button's name and the dialog's title: one thing, said once. */
    label: string;
    /** A 16px inline SVG. The label hides under a finger; this is what stays. */
    icon: ReactNode;
    /** Layout on the button, for the topbar to place it. */
    className?: string;
    /** Text for a closing button under the content. Omit for none. */
    done?: string;
    children: ReactNode;
}

/**
 * A topbar button and the dialog it opens: the shell that map options and
 * credits share.
 *
 * showModal() for the same reason PlaceModal uses it — the platform's focus
 * trap, inert background and Escape handling. The dialog's contents are in the
 * server-rendered HTML whether or not it has ever been opened, which matters
 * for the credits: the notices are part of the page, not fetched on a click.
 */
export function TopbarDialog({ label, icon, className, done, children }: TopbarDialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    // <dialog> treats the backdrop as part of the element, so a click lands on
    // the dialog itself only when it fell outside the panel's bounds.
    function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
        const dialog = ref.current;
        if (!dialog || event.target !== dialog) return;
        const { top, left, width, height } = dialog.getBoundingClientRect();
        const inside =
            event.clientX >= left
            && event.clientX <= left + width
            && event.clientY >= top
            && event.clientY <= top + height;
        if (!inside) dialog.close();
    }

    return (
        <>
            <button
                type="button"
                onClick={() => ref.current?.showModal()}
                aria-haspopup="dialog"
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded border border-transparent px-2 py-1.5 text-panel-fg coarse:min-h-(--touch-target-sm) coarse:px-3 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent${className ? ` ${className}` : ''}`}
            >
                {icon}
                <span className="text-[12px] coarse:hidden">{label}</span>
                <span className="sr-only not-coarse:hidden">{label}</span>
            </button>

            {/* biome-ignore lint/a11y/useKeyWithClickEvents: Native dialog cancellation handles Escape; this click handler only dismisses the backdrop. */}
            <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onClick={handleBackdropClick}>
                <header className={styles.header}>
                    <h2 id={titleId} className={styles.title}>
                        {label}
                    </h2>
                    <button type="button" className={styles.close} onClick={() => ref.current?.close()} aria-label="Close">
                        ×
                    </button>
                </header>

                {children}

                {done && (
                    <footer className={styles.footer}>
                        <button type="button" className={styles.done} onClick={() => ref.current?.close()}>
                            {done}
                        </button>
                    </footer>
                )}
            </dialog>
        </>
    );
}
