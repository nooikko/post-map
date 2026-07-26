import type { ReactNode } from 'react';

export function SectionHeading({ children }: { children: ReactNode }) {
    return (
        // Spacing between sections is the sidebar's job (MapShell.module.css);
        // this only owns the gap down to its own content.
        <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.8px] text-muted uppercase">
            {children}
        </h3>
    );
}
