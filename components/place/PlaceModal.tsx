'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import styles from './PlaceModal.module.css';

interface PlaceModalProps {
    children: ReactNode;
}

/**
 * Native <dialog> wrapper for the intercepted place route.
 *
 * showModal() is used rather than a hand-rolled overlay so we keep the
 * platform's focus trap, inert background, and Escape handling — the same
 * reasons the Vite app used <dialog> (src/popups.js).
 *
 * Closing always goes through router.back(), so the URL returns to the map and
 * the browser's forward button reopens the place.
 */
export function PlaceModal({ children }: PlaceModalProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const router = useRouter();

    useEffect(() => {
        const dialog = ref.current;
        if (dialog && !dialog.open) dialog.showModal();
    }, []);

    // Fires for Escape as well as an explicit close() call.
    function handleClose() {
        router.back();
    }

    // <dialog> treats the backdrop as part of the element, so a click lands on
    // the dialog itself only when it fell outside the panel's bounds.
    function handleClick(event: React.MouseEvent<HTMLDialogElement>) {
        if (event.target !== ref.current) return;
        const { top, left, width, height } = ref.current.getBoundingClientRect();
        const inside =
            event.clientX >= left
            && event.clientX <= left + width
            && event.clientY >= top
            && event.clientY <= top + height;
        if (!inside) ref.current.close();
    }

    return (
        <dialog ref={ref} className={styles.dialog} onClose={handleClose} onClick={handleClick}>
            {children}
        </dialog>
    );
}

interface CloseButtonProps {
    className?: string;
}

export function ModalCloseButton({ className }: CloseButtonProps) {
    const router = useRouter();
    return (
        <button
            type="button"
            className={className ?? styles.close}
            onClick={() => router.back()}
            aria-label="Close"
        >
            ×
        </button>
    );
}
