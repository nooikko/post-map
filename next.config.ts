import type { NextConfig } from 'next';

/**
 * Content-Security-Policy.
 *
 * Every page here is prerendered at build time and there is no middleware, so
 * Next cannot mint a per-request nonce — its flight bootstrap ships as seven
 * inline <script> elements with `"nonce":"$undefined"`. That forces
 * `script-src-elem 'unsafe-inline'`, and adding middleware to fix it would make
 * the site render per-request and give up CDN-static serving.
 *
 * So the split matters: `script-src-attr 'none'` still blocks every inline on*
 * handler, which is the vector a sanitizer bypass would actually reach for.
 * Be clear about what remains — with 'unsafe-inline' on script-src-elem, an
 * injected <script> element would run. lib/wiki/sanitize.ts is the real control
 * against that; this header is the backstop, not the other way round.
 *
 * style-src-attr has to stay 'unsafe-inline' because React writes style props
 * (the category swatch, the infobox bars) as attributes, which cannot carry a
 * nonce. The sanitizer strips every style attribute off wiki prose, so nothing
 * untrusted reaches it.
 */
const CSP = [
    "default-src 'self'",
    "script-src-elem 'self' 'unsafe-inline'",
    "script-src-attr 'none'",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "worker-src 'none'",
    'upgrade-insecure-requests',
].join('; ');

// Applied to every route. Next merges headers across matching entries, so the
// cache rules below still land on /tiles and /data.
const SECURITY_HEADERS = [
    { key: 'Content-Security-Policy', value: CSP },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
];

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: '/:path*',
                headers: SECURITY_HEADERS,
            },
            {
                // Tiles are content-addressed by {z}/{x}/{y} and only change when
                // the pyramid is regenerated, which changes the deployment.
                source: '/tiles/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            {
                // Marker GeoJSON is small and revalidates cheaply.
                source: '/data/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' },
                ],
            },
        ];
    },
};

export default nextConfig;
