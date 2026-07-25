'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { MapCore } from '@/lib/map/create';
import { METERS_PER_PIXEL } from '@/lib/map/config';
import { formatDistance, subscribeUnit } from '@/lib/settings/units';

import { useMeasureStore } from './measureStore';

export interface MeasureControls {
    toggle: () => void;
    clear: () => void;
}

interface MeasureInternals {
    coords: number[][];
    line: import('ol/Feature.js').default | null;
    preview: import('ol/Feature.js').default | null;
    source: import('ol/source/Vector.js').default | null;
    dblZoom: import('ol/interaction/DoubleClickZoom.js').default | null;
    cursorOverlay: import('ol/Overlay.js').default | null;
    cursorTip: HTMLDivElement | null;
}

function totalMeters(coords: number[][]): number {
    let sum = 0;
    for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1];
        const b = coords[i];
        sum += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return sum * METERS_PER_PIXEL;
}

/**
 * Multi-segment distance measuring: click to place points, double-click to
 * finish, Escape to cancel. Ported from src/measure.js.
 */
export function useMeasureTool(core: MapCore | null): MeasureControls {
    const ref = useRef<MeasureInternals>({
        coords: [],
        line: null,
        preview: null,
        source: null,
        dblZoom: null,
        cursorOverlay: null,
        cursorTip: null,
    });

    useEffect(() => {
        if (!core) return;
        const { map } = core;
        const self = ref.current;
        let disposed = false;

        const readout = (): string => {
            const n = self.coords.length;
            if (!useMeasureStore.getState().active && n < 2) return '';
            if (n < 2) return 'Click another point to measure';
            return `Total: ${formatDistance(totalMeters(self.coords))} · ${n - 1} segments`;
        };

        const refresh = () => useMeasureStore.setState({ readout: readout() || null });

        void (async () => {
            const [
                { default: VectorLayer },
                { default: VectorSource },
                { default: Overlay },
                { default: DoubleClickZoom },
                { measureStyle },
            ] = await Promise.all([
                import('ol/layer/Vector.js'),
                import('ol/source/Vector.js'),
                import('ol/Overlay.js'),
                import('ol/interaction/DoubleClickZoom.js'),
                import('@/lib/map/measureStyle'),
            ]);
            if (disposed) return;

            const source = new VectorSource();
            self.source = source;

            const layer = new VectorLayer({
                source,
                updateWhileAnimating: true,
                updateWhileInteracting: true,
                style: measureStyle,
            });
            map.addLayer(layer);

            // The native double-click-zoom would fire alongside our own
            // dblclick-to-finish handler. Toggled off while measuring.
            map.getInteractions().forEach((i) => {
                if (i instanceof DoubleClickZoom) self.dblZoom = i;
            });

            const tip = document.createElement('div');
            tip.className = 'measure-cursor-tip';
            self.cursorTip = tip;
            const overlay = new Overlay({
                element: tip,
                offset: [0, 0],
                positioning: 'bottom-left',
                stopEvent: false,
            });
            map.addOverlay(overlay);
            overlay.setPosition(undefined);
            self.cursorOverlay = overlay;
        })();

        const onClick = async (evt: import('ol/MapBrowserEvent.js').default) => {
            if (!useMeasureStore.getState().active || !self.source) return;
            const [{ default: Feature }, { default: Point }, { default: LineString }] =
                await Promise.all([
                    import('ol/Feature.js'),
                    import('ol/geom/Point.js'),
                    import('ol/geom/LineString.js'),
                ]);

            const coord = evt.coordinate;
            self.coords = [...self.coords, coord];
            self.source.addFeature(new Feature({ geometry: new Point(coord) }));

            if (!self.line) {
                self.line = new Feature({ geometry: new LineString(self.coords) });
                self.source.addFeature(self.line);
            } else {
                (self.line.getGeometry() as import('ol/geom/LineString.js').default)
                    .setCoordinates(self.coords);
            }
            refresh();
        };

        const onMove = async (evt: import('ol/MapBrowserEvent.js').default) => {
            if (!useMeasureStore.getState().active || self.coords.length === 0 || !self.source) {
                self.cursorOverlay?.setPosition(undefined);
                return;
            }
            const [{ default: Feature }, { default: LineString }] = await Promise.all([
                import('ol/Feature.js'),
                import('ol/geom/LineString.js'),
            ]);

            const last = self.coords[self.coords.length - 1];
            if (!self.preview) {
                self.preview = new Feature({ geometry: new LineString([last, evt.coordinate]) });
                self.preview.set('preview', true);
                self.source.addFeature(self.preview);
            } else {
                (self.preview.getGeometry() as import('ol/geom/LineString.js').default)
                    .setCoordinates([last, evt.coordinate]);
            }

            const segMeters =
                Math.hypot(evt.coordinate[0] - last[0], evt.coordinate[1] - last[1])
                * METERS_PER_PIXEL;
            if (self.cursorTip) self.cursorTip.textContent = formatDistance(segMeters);
            self.cursorOverlay?.setPosition(evt.coordinate);
        };

        const finish = () => {
            if (self.preview && self.source) {
                self.source.removeFeature(self.preview);
                self.preview = null;
            }
            self.cursorOverlay?.setPosition(undefined);
            self.dblZoom?.setActive(true);
            document.body.classList.remove('measuring');

            if (self.coords.length < 2) {
                hardClear();
                useMeasureStore.setState({ active: false, readout: null });
            } else {
                useMeasureStore.setState({ active: false, readout: readout() });
            }
        };

        const hardClear = () => {
            self.source?.clear();
            self.line = null;
            self.preview = null;
            self.coords = [];
        };

        const onDblClick = (evt: import('ol/MapBrowserEvent.js').default) => {
            if (!useMeasureStore.getState().active) return;
            // Stop the click that precedes a dblclick from adding a duplicate
            // point at the same spot.
            evt.preventDefault();
            evt.stopPropagation();
            finish();
        };

        const onKey = (e: KeyboardEvent) => {
            if (!useMeasureStore.getState().active) return;
            if (e.key !== 'Escape') return;
            hardClear();
            finish();
            useMeasureStore.setState({ active: false, readout: null });
        };

        map.on('click', onClick);
        map.on('pointermove', onMove);
        map.on('dblclick', onDblClick);
        document.addEventListener('keydown', onKey);
        const unsubscribeUnit = subscribeUnit(refresh);

        return () => {
            disposed = true;
            map.un('click', onClick);
            map.un('pointermove', onMove);
            map.un('dblclick', onDblClick);
            document.removeEventListener('keydown', onKey);
            unsubscribeUnit();
            if (self.cursorOverlay) map.removeOverlay(self.cursorOverlay);
            self.cursorTip?.remove();
            document.body.classList.remove('measuring');
        };
    }, [core]);

    const clear = useCallback(() => {
        const self = ref.current;
        self.source?.clear();
        self.line = null;
        self.preview = null;
        self.coords = [];
        self.cursorOverlay?.setPosition(undefined);
        self.dblZoom?.setActive(true);
        document.body.classList.remove('measuring');
        useMeasureStore.setState({ active: false, readout: null });
    }, []);

    const toggle = useCallback(() => {
        const self = ref.current;
        if (useMeasureStore.getState().active) {
            clear();
            return;
        }
        self.source?.clear();
        self.line = null;
        self.preview = null;
        self.coords = [];
        self.dblZoom?.setActive(false);
        document.body.classList.add('measuring');
        useMeasureStore.setState({
            active: true,
            readout: 'Click to start · double-click to finish · Esc to cancel',
        });
    }, [clear]);

    return { toggle, clear };
}
