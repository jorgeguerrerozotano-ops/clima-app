import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Check, Crosshair, Activity } from 'lucide-react';
import { closestPointOnPolyline, pointOnRouteInFreeZone } from '../utils/helpers';
import Button from './ui/Button';
import Card from './ui/Card';

// Corrige el problema de los iconos rotos de Leaflet en Vite/React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapSelector = ({
    initialCenter,
    onConfirm,
    onCancel,
    isOpen,
    routePolyline = [],
    originCoords = null,
    destCoords = null,
    waypoints = [],
    editingIndex = 0,
    canAddWaypoint = false,
    onAddWaypointInMap = null
}) => {
    const { t } = useTranslation();
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const allMarkersRef = useRef([]);
    const newWaypointMarkerRef = useRef(null);
    const [selectedCoords, setSelectedCoords] = useState(initialCenter);
    const [isLocating, setIsLocating] = useState(false);
    const [newWaypointCoords, setNewWaypointCoords] = useState(null);

    const isRouteMode = Boolean(originCoords && destCoords && Array.isArray(waypoints));
    const points = Array.isArray(routePolyline) && routePolyline.length > 0 ? routePolyline : [];

    const snapToRoute = (coords) => {
        if (points.length < 2) return coords;
        const snapped = closestPointOnPolyline({ lat: coords.lat, lon: coords.lon }, points);
        return snapped ? { lat: snapped.lat, lon: snapped.lon } : coords;
    };

    useEffect(() => {
        if (!isOpen) setNewWaypointCoords(null);
    }, [isOpen]);

    // Efecto para inicializar y limpiar el mapa
    useEffect(() => {
        if (!isOpen) return;

        // Pequeño retraso para asegurar que el DOM (la ventana) ya existe visualmente
        const timer = setTimeout(() => {
            if (!mapContainerRef.current) return;

            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
            if (newWaypointMarkerRef.current) {
                newWaypointMarkerRef.current.remove();
                newWaypointMarkerRef.current = null;
            }
            if (allMarkersRef.current.length) {
                allMarkersRef.current.forEach(m => m.remove());
                allMarkersRef.current = [];
            }

            const map = L.map(mapContainerRef.current).setView([initialCenter.lat, initialCenter.lon], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);

            if (points.length > 0) {
                L.polyline(points, { color: '#3b82f6', weight: 4, opacity: 0.8 }).addTo(map);
            }

            const bounds = L.latLngBounds([[initialCenter.lat, initialCenter.lon]]);

            if (isRouteMode) {
                const iconOrigin = L.divIcon({
                    className: 'custom-pin',
                    html: '<div style="background-color:#22c55e;width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                const iconDest = L.divIcon({
                    className: 'custom-pin',
                    html: '<div style="background-color:#ef4444;width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                const iconWaypoint = L.divIcon({
                    className: 'custom-pin',
                    html: '<div style="background-color:#94a3b8;width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                });
                const iconEditing = L.divIcon({
                    className: 'custom-pin',
                    html: '<div style="background-color:#3b82f6;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.4);"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                const mOrigin = L.marker([originCoords.lat, originCoords.lon], { icon: iconOrigin, draggable: false }).addTo(map);
                const mDest = L.marker([destCoords.lat, destCoords.lon], { icon: iconDest, draggable: false }).addTo(map);
                bounds.extend([originCoords.lat, originCoords.lon]);
                bounds.extend([destCoords.lat, destCoords.lon]);
                allMarkersRef.current.push(mOrigin, mDest);

                let editableMarker = null;
                waypoints.forEach((wp, i) => {
                    const isEditing = i === editingIndex;
                    const iconUse = isEditing ? iconEditing : iconWaypoint;
                    const m = L.marker([wp.lat, wp.lon], { icon: iconUse, draggable: isEditing }).addTo(map);
                    bounds.extend([wp.lat, wp.lon]);
                    allMarkersRef.current.push(m);
                    if (isEditing) {
                        editableMarker = m;
                        m.on('dragend', () => {
                            const ll = m.getLatLng();
                            const snapped = snapToRoute({ lat: ll.lat, lon: ll.lng });
                            m.setLatLng([snapped.lat, snapped.lon]);
                            setSelectedCoords(snapped);
                        });
                    }
                });

                map.on('click', (e) => {
                    if (!editableMarker) return;
                    const snapped = snapToRoute({ lat: e.latlng.lat, lon: e.latlng.lng });
                    editableMarker.setLatLng([snapped.lat, snapped.lon]);
                    setSelectedCoords(snapped);
                });

                markerRef.current = editableMarker;
            } else {
                const customIcon = L.divIcon({
                    className: 'custom-pin',
                    html: '<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4);"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                const marker = L.marker([initialCenter.lat, initialCenter.lon], { icon: customIcon }).addTo(map);
                markerRef.current = marker;
                map.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    marker.setLatLng([lat, lng]);
                    setSelectedCoords({ lat, lon: lng });
                });
            }

            if (points.length > 0) bounds.extend(points);
            map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });

            mapInstanceRef.current = map;
            setTimeout(() => map.invalidateSize(), 100);
        }, 100);

        return () => {
            clearTimeout(timer);
            if (newWaypointMarkerRef.current) {
                newWaypointMarkerRef.current.remove();
                newWaypointMarkerRef.current = null;
            }
            if (allMarkersRef.current.length) {
                allMarkersRef.current.forEach(m => m.remove());
                allMarkersRef.current = [];
            }
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [isOpen, isRouteMode]);

    // Marcador temporal "nueva parada" en MapSelector (modo ruta)
    useEffect(() => {
        if (!newWaypointCoords || !mapInstanceRef.current || !isRouteMode) {
            if (newWaypointMarkerRef.current) {
                newWaypointMarkerRef.current.remove();
                newWaypointMarkerRef.current = null;
            }
            return;
        }
        const map = mapInstanceRef.current;
        if (newWaypointMarkerRef.current) {
            newWaypointMarkerRef.current.setLatLng([newWaypointCoords.lat, newWaypointCoords.lon]);
            return;
        }
        const iconNew = L.divIcon({
            className: 'custom-pin',
            html: '<div style="width:22px;height:22px;border-radius:50%;background:#8b5cf6;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.4);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        const m = L.marker([newWaypointCoords.lat, newWaypointCoords.lon], { icon: iconNew, draggable: true }).addTo(map);
        m.on('dragend', () => {
            const ll = m.getLatLng();
            const snapped = points.length >= 2 ? snapToRoute({ lat: ll.lat, lon: ll.lng }) : { lat: ll.lat, lon: ll.lng };
            m.setLatLng([snapped.lat, snapped.lon]);
            setNewWaypointCoords(snapped);
        });
        newWaypointMarkerRef.current = m;
        return () => {
            if (newWaypointMarkerRef.current) {
                newWaypointMarkerRef.current.remove();
                newWaypointMarkerRef.current = null;
            }
        };
    }, [newWaypointCoords, isOpen, isRouteMode]);

    // Manejo de "Mi Ubicación"
    const handleLocateMe = () => {
        if (!navigator.geolocation) return;
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                let coords = { lat: latitude, lon: longitude };
                if (isRouteMode && points.length >= 2) coords = snapToRoute(coords);
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([coords.lat, coords.lon], 15);
                    if (markerRef.current) markerRef.current.setLatLng([coords.lat, coords.lon]);
                    setSelectedCoords(coords);
                    setTimeout(() => mapInstanceRef.current.invalidateSize(), 250);
                }
                setIsLocating(false);
            },
            (error) => {
                if (import.meta.env.DEV) console.error("Error GPS", error);
                setIsLocating(false);
                alert("No se pudo obtener tu ubicación");
            }
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[1000] animate-fade-in overflow-hidden">
            <Card variant="default" padding="none" className="w-full max-w-md h-[90vh] max-h-[90vh] rounded-3xl flex flex-col my-auto shrink-0 overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-400" /> {t('location.chooseLocation')}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={onCancel} className="p-1.5 rounded-full" title={t('common.close')} aria-label={t('common.close')}>
                        <X className="w-5 h-5 text-slate-400" />
                    </Button>
                </div>
                
                <div className="relative flex-1 min-h-0 max-h-[45vh] w-full bg-slate-800">
                    {/* El contenedor del mapa */}
                    <div ref={mapContainerRef} className="h-full w-full z-0"></div>
                    
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleLocateMe}
                        isLoading={isLocating}
                        className="absolute bottom-4 right-4 z-[500] px-4 py-3 rounded-xl shadow-xl border border-primary/30 flex items-center gap-2"
                    >
                        {!isLocating && <Crosshair className="w-5 h-5" />}
                        <span className="font-bold text-xs">Mi Ubicación</span>
                    </Button>
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-2 shrink-0">
                    {isRouteMode && canAddWaypoint && !newWaypointCoords && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => {
                                const existing = [originCoords, destCoords, ...waypoints].filter(Boolean);
                                const defaultPos = pointOnRouteInFreeZone(points, existing) || (originCoords && destCoords ? { lat: (originCoords.lat + destCoords.lat) / 2, lon: (originCoords.lon + destCoords.lon) / 2 } : null);
                                if (defaultPos) setNewWaypointCoords(defaultPos);
                            }}
                            className="w-full py-2 rounded-xl border border-dashed border-border-default text-muted hover:border-primary hover:text-primary font-bold text-xs uppercase tracking-wider"
                        >
                            {t('routes.addStop')}
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => {
                            const coords = isRouteMode && points.length >= 2 ? snapToRoute(selectedCoords) : selectedCoords;
                            onConfirm(coords);
                            if (newWaypointCoords && typeof onAddWaypointInMap === 'function') {
                                const snapped = points.length >= 2 ? snapToRoute(newWaypointCoords) : newWaypointCoords;
                                onAddWaypointInMap(snapped.lat, snapped.lon);
                            }
                        }}
                        className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
                    >
                        <Check className="w-5 h-5" /> {t('location.confirmLocation')}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default MapSelector;