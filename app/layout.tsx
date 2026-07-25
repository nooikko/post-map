import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, Spectral } from 'next/font/google';

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
            </body>
        </html>
    );
}
