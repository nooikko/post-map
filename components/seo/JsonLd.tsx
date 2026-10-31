import type { JsonLdNode } from '@/lib/seo/jsonLd';

export function JsonLd({ data }: { data: JsonLdNode }) {
    // `<` is the one character that could close the script early; stringify
    // does not escape it.
    const json = JSON.stringify(data).replace(/</g, '\\u003c');

    return (
        <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires literal JSON rather than HTML entities; the payload is escaped above.
            dangerouslySetInnerHTML={{ __html: json }}
        />
    );
}
