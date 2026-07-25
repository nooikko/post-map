import { MapShell } from '@/components/map/MapShell';
import { loadMarkers } from '@/lib/markers/load';

/**
 * The map. Markers are read from disk at build time and handed to the client
 * as props, so there is no post-hydration waterfall of eight GeoJSON fetches.
 */
export default async function MapPage() {
    const markers = await loadMarkers();
    return <MapShell markers={markers} />;
}
