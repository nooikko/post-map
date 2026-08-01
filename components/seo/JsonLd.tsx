import type { JsonLdNode } from '@/lib/seo/jsonLd';

/**
 * Renders a JSON-LD document into the page.
 *
 * `dangerouslySetInnerHTML` rather than a text child, because React escapes
 * children as HTML entities and `&quot;` inside a <script> is not valid JSON —
 * the block would parse as nothing at all.
 */
export function JsonLd({ data }: { data: JsonLdNode }) {
    // `<` is the one character that could close the script early; stringify
    // does not escape it.
    const json = JSON.stringify(data).replace(/</g, '\\u003c');

    return (
        <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger -- escaped above
            dangerouslySetInnerHTML={{ __html: json }}
        />
    );
}
