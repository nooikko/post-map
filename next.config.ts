import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    async headers() {
        return [
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
