'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';

// Fix for default marker icon missing in Leaflet with Webpack
const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

// @ts-expect-error - Leaflet internal property
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

interface MapProps {
    position: [number, number] | null;
    route: [number, number][];
    trail?: [number, number][];
    flightCode?: string;
    heading?: number;
    isEstimated?: boolean;
    departureCode?: string;
    arrivalCode?: string;
    departureName?: string;
    arrivalName?: string;
}

function MapUpdater({ position, route }: { position: [number, number] | null, route: [number, number][] }) {
    const map = useMap();
    const hasFlown = useRef(false);

    // Fly to bounds on route load
    useEffect(() => {
        if (route.length > 0 && !hasFlown.current) {
            const bounds = L.latLngBounds(route);
            if (bounds.isValid()) {
                map.flyToBounds(bounds, {
                    padding: [50, 50],
                    duration: 1.5,
                    easeLinearity: 0.25
                });
                hasFlown.current = true;
            }
        }
    }, [route, map]);

    // Center on plane if no route or tracking
    useEffect(() => {
        if (position && !hasFlown.current) {
            map.setView(position, map.getZoom());
        }
    }, [position, map]);

    return null;
}

import '@/lib/MovingMarker';

export default function Map({ position, route, trail = [], flightCode, heading = 0, isEstimated = false, departureCode, arrivalCode, departureName, arrivalName }: MapProps) {
    // Memoize the icon (static, rotation handled via CSS)
    const planeIcon = useMemo(() => {
        return L.divIcon({
            className: 'custom-plane-icon',
            html: `<div class="plane-rotation-wrapper" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; opacity: ${isEstimated ? 0.7 : 1}; filter: ${isEstimated ? 'grayscale(50%) hue-rotate(320deg) saturate(2) brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.2))' : 'hue-rotate(320deg) saturate(2) brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.2))'}; transition: transform 0.3s linear;">
              <img src="https://cdn-icons-png.flaticon.com/512/7893/7893979.png" style="width: 100%; height: 100%;" />
             </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20],
        });
    }, [isEstimated]);

    const defaultCenter: [number, number] = [20, 0];

    return (
        <div className="relative w-full" style={{
            minHeight: '600px',
            height: '70vh',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.12)',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '1rem',
            overflow: 'hidden'
        }}>
            <div className="absolute inset-0" style={{
                filter: 'brightness(0.92) contrast(1.15) saturate(1.3)',
                imageRendering: 'auto'
            }}>
                <MapContainer
                    key={`map-${Date.now()}`} // Force new instance on remount to avoid 'container reused' error
                    center={defaultCenter}
                    zoom={2}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png"
                        maxZoom={20}
                    />

                    {/* Remaining Route (Red Dashed - Current -> Dest) */}
                    {route.length > 1 && (
                        <Polyline
                            positions={[
                                position || route[0], // Start at current position or origin
                                route[route.length - 1] // End at destination
                            ]}
                            color="#ef4444"
                            dashArray="6, 4"
                            weight={2.5}
                            opacity={0.7}
                            className="animate-draw-route"
                        />
                    )}

                    {/* Actual Flown Trail (Green Solid - Covered) */}
                    {route.length > 0 && (
                        <Polyline
                            positions={[
                                route[0], // Always start at Origin
                                ...trail, // Add any recorded trail points
                                ...(position ? [position] : []) // End at Current Position
                            ]}
                            color="#22c55e"
                            weight={3}
                            opacity={1}
                            className="flight-trail"
                        />
                    )}

                    {/* Departure Airport Marker */}
                    {route.length > 0 && (
                        <Marker
                            position={route[0]}
                            icon={L.divIcon({
                                className: 'airport-marker',
                                html: `<div style="display: flex; flex-direction: column; align-items: center;">
                                    <div style="background: #334155; border-radius: 50%; padding: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid white; display: flex; align-items: center; justify-content: center;">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M2 22h20"/>
                                            <path d="M6.36 17.4 4 17l-2-2 1.1-2.2a1 1 0 0 1 1.1-.5l9 2.5L19 4l2 2-7.8 11.6L6.36 17.4z"/>
                                        </svg>
                                    </div>
                                    <div style="margin-top: 4px; background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #334155; box-shadow: 0 2px 6px rgba(0,0,0,0.2); white-space: nowrap;">${departureCode || 'DEP'}</div>
                                </div>`,
                                iconSize: [60, 60],
                                iconAnchor: [30, 20],
                            })}
                        >
                            <Popup>
                                <div className="text-center">
                                    <div className="font-bold text-green-600">{departureCode || 'Departure'}</div>
                                    <div className="text-sm text-gray-600">{departureName || 'Departure Airport'}</div>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Arrival Airport Marker */}
                    {route.length > 1 && (
                        <Marker
                            position={route[route.length - 1]}
                            icon={L.divIcon({
                                className: 'airport-marker',
                                html: `<div style="display: flex; flex-direction: column; align-items: center;">
                                    <div style="background: #334155; border-radius: 50%; padding: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid white; display: flex; align-items: center; justify-content: center;">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M2 22h20"/>
                                            <path d="M19 17.4 21 17l2-2-1.1-2.2a1 1 0 0 0-1.1-.5l-9 2.5L6 4 4 6l7.8 11.6L19 17.4z"/>
                                        </svg>
                                    </div>
                                    <div style="margin-top: 4px; background: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; color: #334155; box-shadow: 0 2px 6px rgba(0,0,0,0.2); white-space: nowrap;">${arrivalCode || 'ARR'}</div>
                                </div>`,
                                iconSize: [60, 60],
                                iconAnchor: [30, 20],
                            })}
                        >
                            <Popup>
                                <div className="text-center">
                                    <div className="font-bold text-blue-600">{arrivalCode || 'Arrival'}</div>
                                    <div className="text-sm text-gray-600">{arrivalName || 'Arrival Airport'}</div>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Initialize our custom map logic */}
                    <MapLogic
                        position={position}
                        route={route}
                        trail={trail}
                        flightCode={flightCode}
                        heading={heading}
                        isEstimated={isEstimated}
                        planeIcon={planeIcon}
                    />
                    {/* Map Updater for FlyTo bounds */}
                    <MapUpdater position={position} route={route} />
                </MapContainer>
            </div>
        </div>
    );
}

// Helper component to use useMap() context
function MapLogic({ position, route, trail, flightCode, heading, isEstimated, planeIcon }: any) {
    const map = useMap();
    const markerRef = useRef<any>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const routeRef = useRef<[number, number][]>(route);

    useEffect(() => {
        routeRef.current = route;
    }, [route]);

    // Manage Marker and Dashed Line
    useEffect(() => {
        if (!position) return;

        // Helper to apply rotation
        const applyRotation = (marker: any) => {
            const el = marker.getElement();
            if (el) {
                const wrapper = el.querySelector('.plane-rotation-wrapper');
                if (wrapper) {
                    // Subtract 90 degrees to offset the default rightward orientation of the icon
                    wrapper.style.transform = `rotate(${heading - 90}deg)`;
                }
            }
        };

        // Initial Creation
        if (!markerRef.current) {
            // @ts-ignore - movingMarker is added by the plugin
            const marker = L.Marker.movingMarker([position], [10000], {
                icon: planeIcon
            }).addTo(map);

            // Bind Popup
            const popupContent = document.createElement('div');
            popupContent.className = 'text-center';
            popupContent.innerHTML = `
                <span class="font-bold">${flightCode || 'Unknown'}</span><br />
                ${isEstimated ? '<span class="text-xs font-bold text-orange-500 uppercase">Estimated Position</span><br />' : ''}
                Lat: ${position[0].toFixed(4)}, Lon: ${position[1].toFixed(4)}<br />
                Heading: ${Math.round(heading)}°
            `;
            marker.bindPopup(popupContent);

            markerRef.current = marker;

            // Apply initial rotation after a small delay to ensure element exists
            setTimeout(() => applyRotation(marker), 0);

            // Create Dashed Polyline (Remaining Route)
            if (routeRef.current.length > 1) {
                const destination = routeRef.current[routeRef.current.length - 1];
                const polyline = L.polyline([position, destination], {
                    color: "#FFD54F",
                    dashArray: "6, 4",
                    weight: 2.5,
                    opacity: 0.7
                }).addTo(map);

                polylineRef.current = polyline;

                // Update polyline as marker moves
                marker.on('move', () => {
                    if (polylineRef.current && routeRef.current.length > 1) {
                        const dest = routeRef.current[routeRef.current.length - 1];
                        polylineRef.current.setLatLngs([marker.getLatLng(), dest]);
                    }
                });
            }
        } else {
            // Update Existing Marker
            const marker = markerRef.current;

            // Update Icon only if isEstimated changed (since heading is now CSS)
            // We can just set it every time, it's cheap if memoized
            marker.setIcon(planeIcon);

            // Update Popup Content
            const popup = marker.getPopup();
            if (popup) {
                const content = `
                    <div class="text-center">
                        <span class="font-bold">${flightCode || 'Unknown'}</span><br />
                        ${isEstimated ? '<span class="text-xs font-bold text-orange-500 uppercase">Estimated Position</span><br />' : ''}
                        Lat: ${position[0].toFixed(4)}, Lon: ${position[1].toFixed(4)}<br />
                        Heading: ${Math.round(heading)}°
                    </div>
                `;
                popup.setContent(content);
            }

            // Apply Rotation
            applyRotation(marker);

            // Move Marker Smoothly
            // moveTo(latlng, duration)
            marker.moveTo(position, 10000);

            // Ensure dashed line exists if route appeared later
            if (!polylineRef.current && routeRef.current.length > 1) {
                const destination = routeRef.current[routeRef.current.length - 1];
                const polyline = L.polyline([marker.getLatLng(), destination], {
                    color: "#FFD54F",
                    dashArray: "6, 4",
                    weight: 2.5,
                    opacity: 0.7
                }).addTo(map);
                polylineRef.current = polyline;

                marker.on('move', () => {
                    if (polylineRef.current && routeRef.current.length > 1) {
                        const dest = routeRef.current[routeRef.current.length - 1];
                        polylineRef.current.setLatLngs([marker.getLatLng(), dest]);
                    }
                });
            }
        }
    }, [position, map, planeIcon, flightCode, heading, isEstimated]);

    useEffect(() => {
        return () => {
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
            if (polylineRef.current) {
                polylineRef.current.remove();
                polylineRef.current = null;
            }
        };
    }, [map]);

    return null;
}
