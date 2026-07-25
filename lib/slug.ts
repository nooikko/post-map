// URL slugs for place routes.
//
// Marker names are free text from the source map — spaces, apostrophes, and
// diacritics ("Baldur's Gate", "Khôltar"). They are also not unique: the
// current data has two genuine collisions (see resolveSlugs). Until Phase 2
// mints real marker IDs, slugs are derived from names and disambiguated with a
// numeric suffix.

/**
 * Name → URL-safe slug. Not guaranteed unique; use resolveSlugs for that.
 *
 * Diacritics are folded rather than encoded so URLs stay readable:
 * "Khôltar" → "kholtar", not "kh%C3%B4ltar".
 */
export function slugify(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip combining marks
        .replace(/[\u0027\u2019]/g, '') // apostrophes vanish: "Baldur's" -> "baldurs"
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export interface SlugCollision {
    slug: string;
    name: string;
    /** 1-based position among entries sharing this base slug. */
    ordinal: number;
}

export interface SlugAssignment<T> {
    /** Input items, each paired with its final unique slug. */
    entries: Array<{ item: T; slug: string }>;
    /** Lookup from assigned slug back to the item. */
    bySlug: Map<string, T>;
    /** Every case where a base slug had to be suffixed. Callers should log these. */
    collisions: SlugCollision[];
}

/**
 * Assign a unique slug to each item, in the order given.
 *
 * The first item to claim a base slug keeps it; later ones get "-2", "-3", …
 * This means slug stability depends on input order, so callers must pass items
 * in a deterministic order (see lib/markers/load.ts, which sorts by layer
 * render order then by position within the source file).
 *
 * Known collisions in the current data:
 *   - "Laviguer" appears in both Cities and Sites
 *   - "The Twin Towers" appears twice inside Temples.json
 *
 * Both are preserved as distinct routes rather than silently deduplicated —
 * they are separate pins on the map even when they share an article.
 */
export function resolveSlugs<T>(items: readonly T[], nameOf: (item: T) => string): SlugAssignment<T> {
    const seen = new Map<string, number>();
    const entries: Array<{ item: T; slug: string }> = [];
    const bySlug = new Map<string, T>();
    const collisions: SlugCollision[] = [];

    for (const item of items) {
        const name = nameOf(item);
        const base = slugify(name);
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);

        const slug = count === 1 ? base : `${base}-${count}`;
        if (count > 1) collisions.push({ slug, name, ordinal: count });

        entries.push({ item, slug });
        bySlug.set(slug, item);
    }

    return { entries, bySlug, collisions };
}
