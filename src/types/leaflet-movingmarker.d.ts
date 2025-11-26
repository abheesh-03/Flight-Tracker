import * as L from 'leaflet';

declare module 'leaflet' {
    namespace Marker {
        class MovingMarker extends Marker {
            constructor(
                latlngs: L.LatLngExpression[],
                durations: number | number[],
                options?: L.MarkerOptions
            );
            start(): void;
            stop(): void;
            pause(): void;
            resume(): void;
            addLatLng(latlng: L.LatLngExpression, duration: number): void;
            moveTo(latlng: L.LatLngExpression, duration: number): void;
            addStation(pointIndex: number, duration: number): void;
            on(type: string, fn: L.LeafletEventHandlerFn, context?: any): this;
            isEnded(): boolean;
            isStarted(): boolean;
            isPaused(): boolean;
        }

        function movingMarker(
            latlngs: L.LatLngExpression[],
            durations: number | number[],
            options?: L.MarkerOptions
        ): MovingMarker;
    }
}
