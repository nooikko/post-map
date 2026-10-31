// Shapes produced by the build-time wiki pipeline and consumed by the
// components in components/place/.

/** A labelled infobox field, discriminated by how it should be rendered. */
export type InfoboxField =
    | { kind: 'text'; label: string; source: string; text: string }
    | { kind: 'lines'; label: string; source: string; lines: string[] }
    | { kind: 'chips'; label: string; source: string; chips: string[] }
    | { kind: 'bars'; label: string; source: string; parts: InfoboxPart[] };

export type InfoboxPart =
    | { kind: 'text'; text: string }
    | { kind: 'bars'; rows: InfoboxBar[] };

export interface InfoboxBar {
    name: string;
    /** The raw cell text, e.g. "34%" — shown verbatim next to the bar. */
    label: string;
    /** Parsed percentage, or null when the cell wasn't numeric. */
    pct: number | null;
}

export interface InfoboxGroup {
    heading: string | null;
    fields: InfoboxField[];
}

/** Attribution facts for one article. Required on every article view. */
export interface ArticleMeta {
    /** Canonical wiki page name — what the CC BY-SA backlink points at. */
    name: string;
    title: string;
    fetchedAt: string;
}

export interface PlaceArticle {
    meta: ArticleMeta;
    /** Cleaned article body as an HTML string, infobox removed. */
    proseHtml: string;
    groups: InfoboxGroup[];
    /** Primary alias, promoted into the panel subtitle. */
    epithet: string | null;
    /**
     * Set when this place redirects to an article we don't mirror. proseHtml is
     * then empty and the component renders a pointer to the live wiki instead.
     */
    redirectTo: string | null;
}
