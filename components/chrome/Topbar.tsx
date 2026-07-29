'use client';

import { PROJECT_NAME, REPO_URL } from '@/lib/attribution';

interface TopbarProps {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
}

export function Topbar({ sidebarOpen, onToggleSidebar }: TopbarProps) {
    return (
        <header className="absolute inset-x-0 top-0 z-500 flex h-(--topbar-h) items-center gap-2.5 border-b border-edge bg-panel px-3.5 text-[13px] backdrop-blur-lg select-none">
            <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                aria-expanded={sidebarOpen}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-transparent px-2 py-1.5 text-panel-fg hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="2" y="3.5" width="12" height="1.6" rx="0.5" fill="currentColor" />
                    <rect x="2" y="7.2" width="12" height="1.6" rx="0.5" fill="currentColor" />
                    <rect x="2" y="11" width="12" height="1.6" rx="0.5" fill="currentColor" />
                </svg>
            </button>
            <span className="font-bold tracking-[0.4px]">
                {PROJECT_NAME}
                <span className="text-muted before:mx-2 before:content-['·']">Faerûn</span>
            </span>
            {/*
              * Only while the sidebar is closed — open, the GitHub corner in
              * the sidebar's bottom-left is the link, and showing both would
              * put the same destination on screen twice.
              *
              * ml-auto rather than a spacer element, so it stays pinned right
              * whatever the title runs to.
              */}
            {!sidebarOpen && (
                <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${PROJECT_NAME} source on GitHub`}
                    title={`${PROJECT_NAME} source on GitHub`}
                    className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded border border-transparent px-2 py-1.5 text-panel-fg hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                >
                    {/* Inline path, not a remote asset: the CSP is img-src 'self' data:. */}
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                    </svg>
                </a>
            )}
        </header>
    );
}
