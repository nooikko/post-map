'use client';

import { PROJECT_NAME } from '@/lib/attribution';

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
        </header>
    );
}
