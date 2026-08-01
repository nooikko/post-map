import type { ReactNode } from 'react';

export function SectionHeading({ children }: { children: ReactNode }) {
    return (
        // Spacing between sections is the sidebar's job (MapShell.module.css);
        // this only owns the gap down to its own content.
        //
        // h2, because these are the sections directly under the sidebar
        // masthead's h1 (SiteMasthead). It reads as small-caps chrome, but the
        // outline it belongs to is the page's, and skipping a level there is
        // what makes a document sound broken to a screen reader stepping
        // through headings.
        <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.8px] text-muted uppercase">
            {children}
        </h2>
    );
}
