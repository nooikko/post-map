import type { Metadata } from 'next';
import Link from 'next/link';

import { PROJECT_NAME, REPO_URL, WIKI_NAME } from '@/lib/attribution';

import styles from './page.module.css';

/**
 * The privacy policy, and the canonical copy of it — PRIVACY.md at the repo
 * root only points here, so there is one wording to keep true rather than two
 * that drift.
 *
 * Everything stated below is a claim about what the deployed site actually
 * does, so it has to be revisited whenever app/layout.tsx changes what is
 * mounted, or lib/settings/units.ts changes what is stored. Two things are
 * deliberately absent: any claim that Do Not Track or Global Privacy Control
 * is honoured (neither Vercel package implements either), and any claim of
 * compliance with a particular regulation. Describing what is collected is
 * something this page can stand behind; a compliance guarantee is not.
 */

/** Bumped by hand when the wording changes; git history is the real log. */
const LAST_UPDATED = '1 August 2026';

export const metadata: Metadata = {
    title: `Privacy · ${PROJECT_NAME}`,
    description: `What ${PROJECT_NAME} measures, what it does not, and how long any of it is kept.`,
};

export default function PrivacyPage() {
    return (
        <main className={styles.page}>
            <article className={styles.sheet}>
                <header className={styles.header}>
                    <div className={styles.heading}>
                        <h1 className={styles.title}>Privacy</h1>
                        <span className={styles.updated}>Last updated {LAST_UPDATED}</span>
                    </div>
                    <Link href="/" className={styles.back} aria-label="Back to the map">
                        ×
                    </Link>
                </header>

                <div className={styles.body}>
                    <p className={styles.lede}>
                        {PROJECT_NAME} has no accounts, no comments, no forms and nothing to
                        sign up for. The only things measured are how many people visit and
                        how quickly pages load.
                    </p>

                    <h2>What is collected</h2>
                    <p>
                        The site uses two of Vercel&rsquo;s own tools on their free tier:{' '}
                        <strong>Web Analytics</strong>, which counts page views, and{' '}
                        <strong>Speed Insights</strong>, which measures how fast pages render.
                    </p>
                    <p>Web Analytics records, for each page view:</p>
                    <ul>
                        <li>the time, the page address, and the route it matched</li>
                        <li>the site you followed a link from, if any</li>
                        <li>browser, operating system, and whether you are on a phone,
                            tablet or desktop</li>
                        <li>an approximate location worked out from your network connection
                            — country, region and city. Not a precise location, and not
                            anything your device reports.</li>
                    </ul>
                    <p>Speed Insights records the page, standard web performance timings and
                        the page element each one relates to, a rough connection speed such as
                        &ldquo;4g&rdquo;, browser, operating system, device type, and country
                        only.</p>

                    <h2>What is not collected</h2>
                    <ul>
                        <li><strong>No cookies.</strong> Neither tool writes anything to your
                            browser.</li>
                        <li><strong>No name, email address or account</strong>, because there
                            is nothing here to give one to.</li>
                        <li><strong>No IP address stored against a visit.</strong> To tell a
                            returning visitor from a new one within a single day, Vercel
                            derives a hash from the request. That hash is discarded and
                            regenerated every 24 hours, so it cannot follow anyone from one
                            day to the next, or from this site to any other.</li>
                        <li><strong>No advertising networks and no third-party trackers.</strong>{' '}
                            Nothing collected is sold or shared with anyone.</li>
                        <li><strong>Nothing you type.</strong> Place search runs entirely in
                            your browser, over marker data already downloaded with the page,
                            so search terms are never sent anywhere. The same goes for
                            distances you measure.</li>
                    </ul>

                    <h2>Where it goes and how long it stays</h2>
                    <p>
                        To Vercel, who host the site and process this for it, in the United
                        States and the other places they operate. Nobody else receives it.
                    </p>
                    <p>
                        The free tier keeps roughly a month of visitor figures and about a
                        week of performance measurements, and Vercel may hold data longer than
                        that at their own discretion. The daily visitor hash is gone after 24
                        hours.
                    </p>
                    <p>
                        Vercel describe both tools themselves:{' '}
                        <Ext href="https://vercel.com/docs/analytics/privacy-policy">
                            Web Analytics privacy
                        </Ext>
                        ,{' '}
                        <Ext href="https://vercel.com/docs/speed-insights/privacy-policy">
                            Speed Insights privacy
                        </Ext>
                        , and their{' '}
                        <Ext href="https://vercel.com/legal/privacy-policy">privacy notice</Ext>.
                    </p>

                    <h2>Everything else</h2>
                    <ul>
                        <li><strong>Hosting.</strong> Vercel serves every request and, like
                            any web server, sees that request — address and browser — in the
                            ordinary course of delivering the page.</li>
                        <li><strong>Your browser.</strong> One thing is stored locally: a{' '}
                            <code>postmap:units:v1</code> entry remembering whether you prefer
                            miles or kilometres. It never leaves your machine, and clearing
                            site data removes it.</li>
                        <li><strong>Fonts.</strong> The typefaces are downloaded once when the
                            site is built and served from here, so loading a page makes no
                            request to Google.</li>
                        <li><strong>Map tiles and articles.</strong> Served from this site.
                            Reading a place article fetches nothing from the {WIKI_NAME} — the
                            text was mirrored at build time.</li>
                        <li><strong>Links out.</strong> Links to the {WIKI_NAME}, GitHub,
                            Wizards of the Coast and Creative Commons are governed by those
                            sites&rsquo; own policies rather than this one.</li>
                    </ul>

                    <h2>Changes</h2>
                    <p>
                        This page lives in the{' '}
                        <Ext href={REPO_URL}>repository</Ext> alongside the code, so its
                        history is the change log. There is no mailing list to be added to.
                    </p>

                    <h2>Questions</h2>
                    <p>
                        Open an <Ext href={`${REPO_URL}/issues`}>issue</Ext>, or send it{' '}
                        <Ext href={`${REPO_URL}/security/advisories/new`}>privately</Ext> if
                        you would rather not ask in public.
                    </p>
                </div>
            </article>
        </main>
    );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}
