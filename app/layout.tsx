import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, Spectral } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { PROJECT_NAME } from '@/lib/attribution';

import './globals.css';

// Cormorant for display headings, Spectral for article prose — matching the
// weights the Vite app loaded via @fontsource.
const cormorant = Cormorant_Garamond({
    subsets: ['latin', 'latin-ext'],
    weight: ['600', '700'],
    variable: '--font-cormorant',
    display: 'swap',
});

const spectral = Spectral({
    subsets: ['latin', 'latin-ext'],
    weight: ['400', '500', '600'],
    style: ['normal', 'italic'],
    variable: '--font-spectral',
    display: 'swap',
});

export const metadata: Metadata = {
    title: `Faerûn · ${PROJECT_NAME}`,
    description: `${PROJECT_NAME} — an interactive map of Faerûn with place articles from the Forgotten Realms Wiki.`,
};

interface RootLayoutProps {
    children: ReactNode;
    modal: ReactNode;
}

export default function RootLayout({ children, modal }: RootLayoutProps) {
    return (
        <html lang="en" className={`${cormorant.variable} ${spectral.variable}`}>
            <body className="h-full antialiased">
                {children}
                {modal}
                {/*
                 * Production only, and that is a CSP decision rather than a
                 * preference. In development both packages point their
                 * <script src> at https://va.vercel-scripts.com, which
                 * `script-src-elem 'self'` blocks — so leaving them mounted
                 * would mean either a console full of CSP violations or
                 * loosening the dev policy to admit an external origin.
                 * Nothing is lost by gating: Vercel's development script logs
                 * to the console instead of sending anything. In production
                 * both resolve to same-origin paths under /_vercel, so the
                 * policy in next.config.ts needs no exception at all.
                 *
                 * Leave both components bare. `dsn` on <SpeedInsights /> is
                 * the one prop that would send the script back out to
                 * va.vercel-scripts.com even in production.
                 *
                 * What they collect, and for how long, is documented at
                 * /privacy — app/privacy/page.tsx.
                 */}
                {process.env.NODE_ENV === 'production' && (
                    <>
                        <Analytics />
                        <SpeedInsights />
                    </>
                )}
            </body>
        </html>
    );
}
