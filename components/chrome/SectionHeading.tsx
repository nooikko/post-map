import type { ReactNode } from 'react';

export function SectionHeading({ children }: { children: ReactNode }) {
    return (
        <h3 className="mt-4.5 mb-2 text-[11px] font-semibold tracking-[0.8px] text-muted uppercase first:mt-0">
            {children}
        </h3>
    );
}
