'use client';

import { useCallback, useEffect, useRef, type PointerEvent, type ReactNode } from 'react';

import styles from './BottomSheet.module.css';

interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    /** Accessible name for the dialog. */
    label: string;
    children: ReactNode;
}

/** Drag this far down, as a fraction of sheet height, and releasing dismisses. */
const DISMISS_FRACTION = 0.25;
/** Or let go moving faster than this (px per ms) and it dismisses regardless. */
const FLICK_VELOCITY = 0.5;
/** Movement under this is a tap on the handle, which also dismisses. */
const TAP_SLOP_PX = 6;
/** Backstop in case transitionend never arrives (interrupted, display:none). */
const CLOSE_TIMEOUT_MS = 400;

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        !!window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

/**
 * A sheet that rises over the map, stopping short of the top so a strip of map
 * stays visible — drag it down by the handle, tap the handle, tap the exposed
 * strip, or press Escape to send it back.
 *
 * The dialog is opened and closed imperatively rather than through the `open`
 * attribute because `showModal()` is what puts it in the top layer; setting the
 * attribute renders it inline, without a backdrop or focus trapping.
 */
export function BottomSheet({ open, onClose, label, children }: BottomSheetProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const drag = useRef<{
        id: number;
        startY: number;
        startTime: number;
        dy: number;
        moved: boolean;
    } | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (open) {
            if (!el.open) el.showModal();
            // Next frame, so the browser has painted the closed transform once
            // and has a start value to animate from. Without this the class
            // lands in the same frame as showModal() and the sheet simply
            // appears.
            const raf = requestAnimationFrame(() => el.classList.add(styles.shown));
            return () => cancelAnimationFrame(raf);
        }

        if (!el.open) return;

        el.style.transform = '';
        el.classList.remove(styles.shown);

        if (prefersReducedMotion()) {
            el.close();
            return;
        }

        let timer = 0;
        const done = () => {
            window.clearTimeout(timer);
            el.removeEventListener('transitionend', onEnd);
            if (el.open) el.close();
        };
        const onEnd = (event: TransitionEvent) => {
            if (event.target === el && event.propertyName === 'transform') done();
        };
        el.addEventListener('transitionend', onEnd);
        timer = window.setTimeout(done, CLOSE_TIMEOUT_MS);
        return () => {
            window.clearTimeout(timer);
            el.removeEventListener('transitionend', onEnd);
        };
    }, [open]);

    // Escape reaches the dialog as `cancel`, whose default is to close instantly.
    // Route it through the parent instead so it leaves the same way a drag does.
    const handleCancel = useCallback(
        (event: React.SyntheticEvent<HTMLDialogElement>) => {
            event.preventDefault();
            onClose();
        },
        [onClose],
    );

    // A click whose target is the dialog itself but whose point lies outside the
    // sheet's box landed on the backdrop — the strip of map above it.
    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLDialogElement>) => {
            const el = ref.current;
            if (!el || event.target !== el) return;
            const { top, left, width, height } = el.getBoundingClientRect();
            const inside =
                event.clientX >= left &&
                event.clientX <= left + width &&
                event.clientY >= top &&
                event.clientY <= top + height;
            if (!inside) onClose();
        },
        [onClose],
    );

    const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
        const el = ref.current;
        if (!el) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            id: event.pointerId,
            startY: event.clientY,
            startTime: event.timeStamp,
            dy: 0,
            moved: false,
        };
        el.classList.add(styles.dragging);
    }, []);

    const onPointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        const el = ref.current;
        if (!state || !el || event.pointerId !== state.id) return;
        // Downward only. Dragging up would lift the sheet off the bottom edge
        // and expose the backdrop beneath it.
        const dy = Math.max(0, event.clientY - state.startY);
        state.dy = dy;
        if (dy > TAP_SLOP_PX) state.moved = true;
        el.style.transform = `translateY(${dy}px)`;
    }, []);

    const endDrag = useCallback(
        (event: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
            const state = drag.current;
            const el = ref.current;
            if (!state || !el || event.pointerId !== state.id) return;
            drag.current = null;

            el.classList.remove(styles.dragging);
            // Hand the transform back to the stylesheet, which springs the sheet
            // home if it survives and carries it off-screen if it does not.
            el.style.transform = '';

            if (cancelled) return;

            const elapsed = Math.max(1, event.timeStamp - state.startTime);
            const velocity = state.dy / elapsed;
            const travelled = state.dy > el.getBoundingClientRect().height * DISMISS_FRACTION;

            if (!state.moved || travelled || velocity > FLICK_VELOCITY) onClose();
        },
        [onClose],
    );

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Native dialog cancellation handles Escape; this click handler only dismisses the backdrop.
        <dialog
            ref={ref}
            className={styles.sheet}
            aria-label={label}
            onCancel={handleCancel}
            onClick={handleClick}
            onClose={onClose}
        >
            <button
                type="button"
                className={styles.grab}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => endDrag(event, false)}
                onPointerCancel={(event) => endDrag(event, true)}
                aria-label="Close"
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onClose();
                    }
                }}
            >
                <span className={styles.handle} aria-hidden="true" />
            </button>
            <div className={styles.body}>{children}</div>
        </dialog>
    );
}
