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
    /** Set briefly after finishing, so the trailing dblclick can be swallowed. */
    justFinished: boolean;
}

/**
 * How close a click has to land on an existing vertex to count as hitting it.
 * Measured in screen pixels rather than map units so the target stays the same
 * physical size at every zoom level.
 */
const VERTEX_HIT_PX = 12;

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
        justFinished: false,
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

        /** Did this click land on the given vertex, within the hit tolerance? */
        const nearVertex = (
            coord: number[],
            evt: import('ol/MapBrowserEvent.js').default,
        ): boolean => {
            const pixel = map.getPixelFromCoordinate(coord);
            if (!pixel) return false;
            return Math.hypot(pixel[0] - evt.pixel[0], pixel[1] - evt.pixel[1]) <= VERTEX_HIT_PX;
        };

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

            const n = self.coords.length;

            // Clicking the first vertex closes the path into a circuit and
            // finishes. Needs three points to be a circuit rather than a line
            // retraced over itself. The closing coordinate is appended, so the
            // returning leg counts toward the total like any other segment.
            if (n >= 3 && nearVertex(self.coords[0], evt)) {
                self.coords = [...self.coords, self.coords[0]];
                (self.line?.getGeometry() as import('ol/geom/LineString.js').default | undefined)
                    ?.setCoordinates(self.coords);
                finish();
                return;
            }

            // Clicking the point you just placed finishes an open path. This is
            // also what makes a double-click work: the second click lands on
            // the vertex the first one placed, so it finishes instead of
            // stacking a duplicate point.
            if (n >= 1 && nearVertex(self.coords[n - 1], evt)) {
                finish();
                return;
            }

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

            // Window in which onDblClick still swallows the trailing event.
            self.justFinished = true;
            window.setTimeout(() => {
                self.justFinished = false;
            }, 500);

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
            const active = useMeasureStore.getState().active;

            // A double-click now finishes via the vertex hit-test on its second
            // click, which leaves this event still to be delivered — by which
            // time finish() has re-enabled DoubleClickZoom. Swallow it, or the
            // map zooms out from under the measurement that was just completed.
            if (!active && !self.justFinished) return;

            evt.preventDefault();
            evt.stopPropagation();
            if (active) finish();
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
            readout: 'Click to add points · last point finishes, first closes · Esc to cancel',
        });
    }, [clear]);

    return { toggle, clear };
}
