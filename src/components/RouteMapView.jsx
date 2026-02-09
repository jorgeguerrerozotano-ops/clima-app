import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pointOnRouteInFreeZone, closestPointOnPolyline, closestPointOnPolylineBetweenFractions, fractionAlongPolyline } from '../utils/helpers';
import RoutePointSummaryCard from './RoutePointSummaryCard';

const STATUS_PIN_COLORS = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };

const RouteMapView = ({
    routeResult,
    onAddWaypoint,
    onEditWaypoint,
    onUpdateWaypoint,
    onCancelEdit,
    onViewReport,
    editingWaypointIndex,
    loading,
    canAddWaypoint,
    spatialRoute,
    originalRouteResult,
    onApplySpatialRoute,
    onRevertToOriginalRoute
}) => {
    const { t } = useTranslation();
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const polylineRef = useRef(null);
    const lastRouteIdRef = useRef(null);
    const addingMarkerRef = useRef(null);
    const [addingWaypoint, setAddingWaypoint] = useState(null);
    const [pendingEditCoords, setPendingEditCoords] = useState(null);
    const [selectedSegmentKey, setSelectedSegmentKey] = useState(null);

    const getSegmentStatus = (key) => routeResult?.segments?.[key]?.status || 'green';
    const pinHtml = (status, sizePx = 18, isDanger = false) => {
        const color = STATUS_PIN_COLORS[status] || STATUS_PIN_COLORS.green;
        const dangerRing = isDanger && status === 'red' ? 'box-shadow:0 0 0 3px rgba(239,68,68,0.6);' : '';
        return `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);${dangerRing}"></div>`;
    };

    useEffect(() => {
        if (!routeResult?.routeGeometry?.length || !mapContainerRef.current) return;

        const geometry = routeResult.routeGeometry || [];
        const origin = routeResult.originCoords;
        const dest = routeResult.destCoords;
        const hasUserWaypoints = (routeResult.waypoints?.length ?? 0) > 0;
        const waypoints = hasUserWaypoints
            ? routeResult.waypoints
            : (routeResult.midCoords ? [routeResult.midCoords] : []);
        const segmentKeys = hasUserWaypoints
            ? ['origin', ...routeResult.waypoints.map((_, i) => 'wp' + i), 'dest']
            : ['origin', 'mid', 'dest'];

        const routeId = `${origin.lat},${origin.lon}|${dest.lat},${dest.lon}|${waypoints.length}|${waypoints.map(w => `${w.lat},${w.lon}`).join(';')}`;

        const addRouteLayers = (map, doFitBounds = true) => {
            if (polylineRef.current) {
                map.removeLayer(polylineRef.current);
                polylineRef.current = null;
            }
            const polyline = L.polyline(geometry, { color: '#3b82f6', weight: 4, opacity: 0.8 }).addTo(map);
            polylineRef.current = polyline;

            markersRef.current.forEach(m => { try { m.remove(); } catch (_) {} });
            markersRef.current = [];

            const statusOrigin = getSegmentStatus('origin');
            const iconOrigin = L.divIcon({
                className: 'route-map-pin route-map-pin--origin',
                html: pinHtml(statusOrigin, 20, statusOrigin === 'red'),
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            const statusDest = getSegmentStatus('dest');
            const iconDest = L.divIcon({
                className: 'route-map-pin route-map-pin--dest',
                html: pinHtml(statusDest, 20, statusDest === 'red'),
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const mOrigin = L.marker([origin.lat, origin.lon], { icon: iconOrigin }).addTo(map);
            const mDest = L.marker([dest.lat, dest.lon], { icon: iconDest }).addTo(map);
            mOrigin.on('click', () => setSelectedSegmentKey('origin'));
            mDest.on('click', () => setSelectedSegmentKey('dest'));
            markersRef.current.push(mOrigin, mDest);

            const bounds = L.latLngBounds(geometry);
            waypoints.forEach((wp, i) => {
                if (!wp || wp.lat == null || wp.lon == null) return;
                const key = segmentKeys[1 + i];
                const status = getSegmentStatus(key);
                const iconWp = L.divIcon({
                    className: 'route-map-pin route-map-pin--waypoint' + (status === 'red' ? ' route-map-pin--danger' : ''),
                    html: pinHtml(status, 18, status === 'red'),
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
                const m = L.marker([wp.lat, wp.lon], { icon: iconWp }).addTo(map);
                m.on('click', () => setSelectedSegmentKey(key));
                markersRef.current.push(m);
                bounds.extend([wp.lat, wp.lon]);
            });

            if (doFitBounds) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
        };

        if (mapInstanceRef.current && lastRouteIdRef.current === routeId) {
            setSelectedSegmentKey(null);
            addRouteLayers(mapInstanceRef.current, false);
            return;
        }

        setAddingWaypoint(null);
        setPendingEditCoords(null);
        setSelectedSegmentKey(null);

        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            polylineRef.current = null;
        }
        markersRef.current.forEach(m => { try { m.remove(); } catch (_) {} });
        markersRef.current = [];

        const map = L.map(mapContainerRef.current).setView([origin.lat, origin.lon], 10);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        addRouteLayers(map, true);
        lastRouteIdRef.current = routeId;
        const mapRef = map;
        mapInstanceRef.current = map;
        const sizeTimer = setTimeout(() => {
            if (mapInstanceRef.current === mapRef) mapRef.invalidateSize();
        }, 150);

        return () => {
            clearTimeout(sizeTimer);
            if (addingMarkerRef.current) {
                addingMarkerRef.current.remove();
                addingMarkerRef.current = null;
            }
            markersRef.current.forEach(m => { try { m.remove(); } catch (_) {} });
            markersRef.current = [];
            polylineRef.current = null;
            if (mapInstanceRef.current === mapRef) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                lastRouteIdRef.current = null;
            }
        };
    }, [routeResult]);

    useEffect(() => {
        if (editingWaypointIndex !== null) setSelectedSegmentKey(null);
    }, [editingWaypointIndex]);

    useEffect(() => {
        if (!addingWaypoint || !mapInstanceRef.current || !routeResult?.routeGeometry?.length) {
            if (addingMarkerRef.current) {
                addingMarkerRef.current.remove();
                addingMarkerRef.current = null;
            }
            return;
        }
        const map = mapInstanceRef.current;
        const geometry = routeResult.routeGeometry || [];
        const origin = routeResult.originCoords;
        const waypoints = routeResult.waypoints?.length ? routeResult.waypoints : (routeResult.midCoords ? [routeResult.midCoords] : []);
        const lastPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : origin;
        const fracMin = lastPoint && geometry.length >= 2 ? Math.min(1, fractionAlongPolyline(lastPoint, geometry) + 0.002) : 0;
        const fracMax = 1;

        const initialSnapped = geometry.length >= 2 ? closestPointOnPolylineBetweenFractions(addingWaypoint, geometry, fracMin, fracMax) : addingWaypoint;
        if (!initialSnapped) return;
        if (addingMarkerRef.current) {
            addingMarkerRef.current.setLatLng([initialSnapped.lat, initialSnapped.lon]);
            setAddingWaypoint({ lat: initialSnapped.lat, lon: initialSnapped.lon });
            return;
        }
        const iconAdding = L.divIcon({
            className: 'route-map-pin route-map-pin--waypoint',
            html: '<div style="width:22px;height:22px;border-radius:50%;background:#8b5cf6;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.4);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        const m = L.marker([initialSnapped.lat, initialSnapped.lon], { icon: iconAdding, draggable: true }).addTo(map);
        const snapPosition = () => {
            const ll = m.getLatLng();
            const snapped = geometry.length >= 2 ? closestPointOnPolylineBetweenFractions({ lat: ll.lat, lon: ll.lng }, geometry, fracMin, fracMax) : { lat: ll.lat, lon: ll.lng };
            if (snapped) m.setLatLng([snapped.lat, snapped.lon]);
            return snapped;
        };
        const onDrag = () => { snapPosition(); };
        const onDragEnd = () => {
            const snapped = snapPosition();
            if (snapped) setAddingWaypoint({ lat: snapped.lat, lon: snapped.lon });
        };
        m.on('drag', onDrag);
        m.on('dragend', onDragEnd);
        addingMarkerRef.current = m;
        return () => {
            m.off('drag', onDrag);
            m.off('dragend', onDragEnd);
            if (addingMarkerRef.current) {
                addingMarkerRef.current.remove();
                addingMarkerRef.current = null;
            }
        };
    }, [addingWaypoint, routeResult?.routeGeometry]);

    // Hacer draggable el marcador del waypoint en edición
    useEffect(() => {
        if (editingWaypointIndex == null || !mapInstanceRef.current || !routeResult) {
            if (editingWaypointIndex == null) setPendingEditCoords(null);
            return;
        }
        const hasUserWaypoints = (routeResult.waypoints?.length ?? 0) > 0;
        const waypoints = hasUserWaypoints
            ? routeResult.waypoints
            : (routeResult.midCoords ? [routeResult.midCoords] : []);
        const geometry = routeResult.routeGeometry || [];
        const origin = routeResult.originCoords;
        const dest = routeResult.destCoords;
        if (editingWaypointIndex < 0 || editingWaypointIndex >= waypoints.length || geometry.length < 2) return;
        const wp = waypoints[editingWaypointIndex];
        setPendingEditCoords({ lat: wp.lat, lon: wp.lon });
        const prevPoint = editingWaypointIndex === 0 ? origin : waypoints[editingWaypointIndex - 1];
        const nextPoint = editingWaypointIndex === waypoints.length - 1 ? dest : waypoints[editingWaypointIndex + 1];
        const fracMin = prevPoint ? Math.min(1, fractionAlongPolyline(prevPoint, geometry) + 0.002) : 0;
        const fracMax = nextPoint ? Math.max(0, fractionAlongPolyline(nextPoint, geometry) - 0.002) : 1;
        const markerIndex = 2 + editingWaypointIndex;
        if (markerIndex >= markersRef.current.length) return;
        const marker = markersRef.current[markerIndex];
        if (!marker) return;
        const getSegmentStatus = (k) => routeResult.segments?.[k]?.status || 'green';
        const segKeys = hasUserWaypoints ? ['origin', ...routeResult.waypoints.map((_, i) => 'wp' + i), 'dest'] : ['origin', 'mid', 'dest'];
        const segKey = segKeys[1 + editingWaypointIndex];
        const segStatus = getSegmentStatus(segKey);
        const pinHtml = (status, sizePx = 18, isDanger = false) => {
            const color = STATUS_PIN_COLORS[status] || STATUS_PIN_COLORS.green;
            const dangerRing = isDanger && status === 'red' ? 'box-shadow:0 0 0 3px rgba(239,68,68,0.6);' : '';
            return `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);${dangerRing}"></div>`;
        };
        const originalIcon = L.divIcon({
            className: 'route-map-pin route-map-pin--waypoint' + (segStatus === 'red' ? ' route-map-pin--danger' : ''),
            html: pinHtml(segStatus, 18, segStatus === 'red'),
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        const editingIcon = L.divIcon({
            className: 'route-map-pin route-map-pin--waypoint route-map-pin--editing',
            html: '<div class="route-map-pin-bounce" style="width:22px;height:22px;border-radius:50%;background:#3b82f6;border:3px solid #93c5fd;box-shadow:0 0 0 4px rgba(59,130,246,0.4);"></div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });
        marker.setIcon(editingIcon);
        marker.dragging.enable();
        const snapToSegment = () => {
            const ll = marker.getLatLng();
            const snapped = closestPointOnPolylineBetweenFractions({ lat: ll.lat, lon: ll.lng }, geometry, fracMin, fracMax);
            if (snapped) {
                marker.setLatLng([snapped.lat, snapped.lon]);
                setPendingEditCoords({ lat: snapped.lat, lon: snapped.lon });
            }
        };
        marker.on('drag', snapToSegment);
        marker.on('dragend', snapToSegment);
        return () => {
            try {
                marker.off('drag', snapToSegment);
                marker.off('dragend', snapToSegment);
                if (marker?.dragging) marker.dragging.disable();
                marker.setIcon(originalIcon);
            } catch (_) {}
        };
    }, [editingWaypointIndex, routeResult]);

    const handleStartAdding = () => {
        setSelectedSegmentKey(null);
        const geometry = routeResult?.routeGeometry || [];
        const origin = routeResult?.originCoords;
        const dest = routeResult?.destCoords;
        const waypoints = routeResult?.waypoints?.length ? routeResult.waypoints : (routeResult?.midCoords ? [routeResult.midCoords] : []);
        const existing = [origin, dest, ...waypoints].filter(Boolean);
        const defaultPos = pointOnRouteInFreeZone(geometry, existing) || (origin && dest ? { lat: (origin.lat + dest.lat) / 2, lon: (origin.lon + dest.lon) / 2 } : null);
        if (defaultPos) setAddingWaypoint(defaultPos);
    };

    const handleConfirmAdding = () => {
        if (!addingWaypoint) return;
        const geometry = routeResult?.routeGeometry || [];
        if (geometry.length < 2) { onAddWaypoint(addingWaypoint.lat, addingWaypoint.lon); setAddingWaypoint(null); return; }
        const waypoints = routeResult?.waypoints?.length ? routeResult.waypoints : (routeResult?.midCoords ? [routeResult.midCoords] : []);
        const origin = routeResult?.originCoords;
        const fracMin = waypoints.length > 0
            ? Math.min(1, fractionAlongPolyline(waypoints[waypoints.length - 1], geometry) + 0.002)
            : (origin ? Math.min(1, fractionAlongPolyline(origin, geometry) + 0.002) : 0);
        const snapped = closestPointOnPolylineBetweenFractions(addingWaypoint, geometry, fracMin, 1) || addingWaypoint;
        onAddWaypoint(snapped.lat, snapped.lon);
        setAddingWaypoint(null);
    };

    const handleConfirmEdit = () => {
        if (editingWaypointIndex == null || !pendingEditCoords || !onUpdateWaypoint) return;
        const geometry = routeResult?.routeGeometry || [];
        if (geometry.length < 2) { onUpdateWaypoint(editingWaypointIndex, pendingEditCoords.lat, pendingEditCoords.lon); return; }
        const waypoints = routeResult?.waypoints?.length ? routeResult.waypoints : (routeResult?.midCoords ? [routeResult.midCoords] : []);
        const origin = routeResult?.originCoords;
        const dest = routeResult?.destCoords;
        const prevPoint = editingWaypointIndex === 0 ? origin : waypoints[editingWaypointIndex - 1];
        const nextPoint = editingWaypointIndex === waypoints.length - 1 ? dest : waypoints[editingWaypointIndex + 1];
        const fracMin = prevPoint ? Math.min(1, fractionAlongPolyline(prevPoint, geometry) + 0.002) : 0;
        const fracMax = nextPoint ? Math.max(0, fractionAlongPolyline(nextPoint, geometry) - 0.002) : 1;
        const snapped = closestPointOnPolylineBetweenFractions(pendingEditCoords, geometry, fracMin, fracMax) || pendingEditCoords;
        onUpdateWaypoint(editingWaypointIndex, snapped.lat, snapped.lon);
    };

    const segmentForCard = selectedSegmentKey ? routeResult.segments?.[selectedSegmentKey] : null;
    const hasUserWaypoints = (routeResult.waypoints?.length ?? 0) > 0;
    const displayWaypoints = hasUserWaypoints ? routeResult.waypoints : (routeResult.midCoords ? [routeResult.midCoords] : []);
    const segmentKeys = hasUserWaypoints ? ['origin', ...routeResult.waypoints.map((_, i) => 'wp' + i), 'dest'] : ['origin', 'mid', 'dest'];

    // Estimado de tamaño del popup (min-w 170, max-w 260; altura ~3 filas) para clamp dentro del mapa
    const POPUP_ESTIMATE_WIDTH = 220;
    const POPUP_ESTIMATE_HEIGHT = 100;
    const POPUP_PADDING = 12;

    const popupPosition = (() => {
        if (!selectedSegmentKey || !segmentForCard || !mapInstanceRef.current || !mapContainerRef.current) return null;
        const origin = routeResult.originCoords;
        const dest = routeResult.destCoords;
        let lat, lon;
        if (selectedSegmentKey === 'origin') { lat = origin.lat; lon = origin.lon; }
        else if (selectedSegmentKey === 'dest') { lat = dest.lat; lon = dest.lon; }
        else {
            const idx = segmentKeys.indexOf(selectedSegmentKey);
            if (idx <= 0 || idx >= segmentKeys.length - 1) return null;
            const wp = displayWaypoints[idx - 1];
            if (!wp) return null;
            lat = wp.lat; lon = wp.lon;
        }
        const map = mapInstanceRef.current;
        const pt = map.latLngToContainerPoint(L.latLng(lat, lon));
        const container = mapContainerRef.current;
        const w = container.clientWidth || 300;
        const h = container.clientHeight || 250;
        const halfW = POPUP_ESTIMATE_WIDTH / 2;
        const left = Math.max(POPUP_PADDING + halfW, Math.min(w - POPUP_PADDING - halfW, pt.x));
        const top = Math.max(POPUP_PADDING + POPUP_ESTIMATE_HEIGHT + 8, Math.min(h - POPUP_PADDING + 8, pt.y));
        return { left, top };
    })();

    const waypointIndexFromKey = (key) => {
        if (key === 'mid') return 0;
        if (key?.startsWith('wp')) return parseInt(key.replace('wp', ''), 10) || 0;
        return null;
    };
    const handleEditFromCard = () => {
        const idx = waypointIndexFromKey(selectedSegmentKey);
        if (idx == null) return;
        setSelectedSegmentKey(null);
        onEditWaypoint?.(idx);
    };

    if (!routeResult) return null;

    const showRevertButton = originalRouteResult != null;
    const showAlternativeButton = spatialRoute != null && originalRouteResult == null;

    return (
        <div className="space-y-3">
            <div className="relative h-[50vh] w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                <div ref={mapContainerRef} className="h-full w-full" />
                {selectedSegmentKey && !addingWaypoint && editingWaypointIndex === null && segmentForCard && (
                    <RoutePointSummaryCard
                        segment={segmentForCard}
                        segmentKey={selectedSegmentKey}
                        position={popupPosition}
                        onEdit={handleEditFromCard}
                        onViewReport={onViewReport ? () => { setSelectedSegmentKey(null); onViewReport(); } : undefined}
                        onClose={() => setSelectedSegmentKey(null)}
                    />
                )}
                {/* Barra inferior del mapa: ruta alternativa o volver a ruta original (botones pequeños) */}
                {(showRevertButton || showAlternativeButton) && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-center gap-2 bg-gradient-to-t from-slate-900/95 to-transparent z-[700]">
                        {showRevertButton && onRevertToOriginalRoute && (
                            <button
                                type="button"
                                onClick={onRevertToOriginalRoute}
                                className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-bold shadow-lg transition-colors active:scale-[0.98]"
                            >
                                {t('routes.revertToOriginalRoute')}
                            </button>
                        )}
                        {showAlternativeButton && onApplySpatialRoute && (
                            <button
                                type="button"
                                onClick={onApplySpatialRoute}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg transition-colors active:scale-[0.98]"
                            >
                                {t('routes.smartSafeSuggestionSpace', { minutes: spatialRoute.extraMinutes ?? 0 })}
                            </button>
                        )}
                    </div>
                )}
            </div>
            {editingWaypointIndex !== null ? (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleConfirmEdit}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        Confirmar posición
                    </button>
                    <button
                        type="button"
                        onClick={onCancelEdit}
                        className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-400 hover:text-white font-bold text-xs uppercase transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            ) : addingWaypoint ? (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleConfirmAdding}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        Confirmar parada
                    </button>
                    <button
                        type="button"
                        onClick={() => setAddingWaypoint(null)}
                        className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-400 hover:text-white font-bold text-xs uppercase transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            ) : canAddWaypoint ? (
                <button
                    type="button"
                    onClick={handleStartAdding}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                    {t('routes.addStop')}
                </button>
            ) : null}
        </div>
    );
};

export default RouteMapView;
