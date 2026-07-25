import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Static raster-map app. Vite bundles OpenLayers from npm (no more esm.sh
// import map) and serves public/ (tiles + data) at the site root.
export default defineConfig({
    // The app uses top-level await (src/main.js) and ships only to modern
    // evergreen browsers — target esnext so esbuild keeps TLA instead of
    // erroring on the default es2020 floor.
    build: { target: 'esnext' },
    plugins: [
        VitePWA({
            // We ship our own service worker (cache-first tiles, "download all
            // tiles" offline mode); the plugin only injects the precache
            // manifest for the hashed build output via self.__WB_MANIFEST.
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.js',
            registerType: 'autoUpdate',
            injectRegister: false, // we register manually in src/sw-register.js
            injectManifest: {
                // OL chunk is well under this; bump only if a chunk exceeds it.
                maximumFileSizeToCacheInBytes: 3_000_000,
            },
            // Keep the SW out of the dev loop so it never fights HMR.
            devOptions: { enabled: false },
        }),
    ],
});
