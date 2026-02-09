import { useState, useRef } from 'react';
import i18n from '../i18n';
import { pointAlongRoute, fractionAlongPolyline } from '../utils/helpers';
import { calculateAdversityScore, findBestTimeSlot, findBestSpatialDetour, ADVERSITY_THRESHOLD } from '../utils/smartRouteLogic';
import {
    analyzeRouteWithWeather,
    getForecastAtTime,
    evaluateSegment,
    isNetworkOrTimeoutError,
} from '../utils/routeWeatherAnalysis';

const t = (k, o) => i18n.t(k, o);

// === HOOK PRINCIPAL ===
export const useRouteWeather = () => {
    /** ID de la última petición de cálculo: solo aplicamos estado si la respuesta corresponde a esta petición (evita race conditions). */
    const routeRequestIdRef = useRef(0);
    const [loading, setLoading] = useState(false);
    const [routeResult, setRouteResult] = useState(null);
    const [routeAlternatives, setRouteAlternatives] = useState([]);
    const [alternativeIndex, setAlternativeIndex] = useState(0);
    const [error, setError] = useState(null);
    const [smartSafeRoute, setSmartSafeRoute] = useState(null);
    const [spatialRoute, setSpatialRoute] = useState(null);
    const [originalRouteResult, setOriginalRouteResult] = useState(null);

    const resetRoute = () => {
        setRouteResult(null);
        setRouteAlternatives([]);
        setAlternativeIndex(0);
        setError(null);
        setSmartSafeRoute(null);
        setSpatialRoute(null);
        setOriginalRouteResult(null);
    };

    const applySpatialRoute = () => {
        if (spatialRoute?.routeResult) {
            setOriginalRouteResult(routeResult);
            setRouteResult(spatialRoute.routeResult);
            setSmartSafeRoute(null);
            // No borrar spatialRoute: así "Ruta más segura" sigue disponible tras volver a la ruta original
        }
    };

    const revertToOriginalRoute = () => {
        if (originalRouteResult) {
            setRouteResult(originalRouteResult);
            setOriginalRouteResult(null);
            // No borrar spatialRoute: el botón "Ruta más segura" debe seguir disponible
        }
    };

    const calculateRoute = async (origin, dest, mode, departureDateObj, options = {}) => {
        if (!origin || !dest) return;
        const myRequestId = ++routeRequestIdRef.current;
        setLoading(true);
        setError(null);
        setRouteResult(null);
        setRouteAlternatives([]);
        setAlternativeIndex(0);
        setSmartSafeRoute(null);
        setSpatialRoute(null);
        try {
            const depDate = departureDateObj;
            const result = await analyzeRouteWithWeather(origin, dest, [], depDate, mode, {
                returnMergedForSmartSafe: true,
            });
            if (myRequestId !== routeRequestIdRef.current) return;
            const primary = result.routeResult ?? result;
            setRouteAlternatives([]);
            setAlternativeIndex(0);
            setRouteResult(primary);

            // Smart Safe: buscar mejor hora (Fase 1) y/o desvío espacial (Fase 2) en segundo plano
            if (primary && (!primary.waypoints || primary.waypoints.length === 0) && result.originMerged) {
                const adversity = calculateAdversityScore(primary);
                if (adversity > ADVERSITY_THRESHOLD) {
                    const durationMinutes = primary.durationMinutes || 30;
                    const timePromise = findBestTimeSlot(
                        primary,
                        depDate,
                        durationMinutes,
                        { originMerged: result.originMerged, destMerged: result.destMerged, midMerged: result.midMerged },
                        mode,
                        { getForecastAtTime, evaluateSegment },
                        { isScheduled: options.isScheduled === true }
                    );
                    const spacePromise = findBestSpatialDetour(
                        primary,
                        depDate,
                        mode,
                        {},
                        { buildRouteWithWaypoints: recalculateWithWaypoints }
                    );
                    Promise.all([timePromise, spacePromise])
                        .then(([timeResult, spaceResult]) => {
                            if (myRequestId !== routeRequestIdRef.current) return;
                            if (spaceResult) setSpatialRoute(spaceResult);
                            else setSpatialRoute(null);
                            let best = timeResult || spaceResult;
                            if (timeResult && spaceResult) {
                                const diff = Math.abs((timeResult.adversityScore ?? 0) - (spaceResult.adversityScore ?? 0));
                                if (diff <= 5) best = timeResult;
                                else best = (timeResult.adversityScore ?? 100) <= (spaceResult.adversityScore ?? 100) ? timeResult : spaceResult;
                            }
                            if (best) setSmartSafeRoute(best);
                        })
                        .catch(() => {});
                }
            }
        } catch (e) {
            if (myRequestId !== routeRequestIdRef.current) return;
            console.error(e);
            setError(isNetworkOrTimeoutError(e) ? t('routes.weatherConnectionError') : t('routes.routeCalcError'));
        } finally {
            if (myRequestId === routeRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    const recalculateWithWaypoints = async (waypoints, depDate, originCoords, destCoords, mode, options = {}) => {
        return analyzeRouteWithWeather(originCoords, destCoords, waypoints, depDate, mode, {
            avoidFerries: options?.avoidFerries === true,
        });
    };

    const addWaypoint = async (optionalLat, optionalLon) => {
        const prev = routeResult;
        if (!prev?.originCoords || !prev?.destCoords || !prev?.depDate || (prev.waypoints?.length ?? 0) >= 3) return;
        const myRequestId = ++routeRequestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const geometry = prev.routeGeometry || [];
            let newPoint;
            if (typeof optionalLat === 'number' && typeof optionalLon === 'number') {
                newPoint = { lat: optionalLat, lon: optionalLon };
            } else {
                const frac = geometry.length >= 2 ? 2 / 3 : 0.5;
                newPoint = pointAlongRoute(geometry, frac) || { lat: (prev.originCoords.lat + prev.destCoords.lat) / 2, lon: (prev.originCoords.lon + prev.destCoords.lon) / 2 };
            }
            let waypoints = !prev.waypoints || prev.waypoints.length === 0
                ? [prev.midCoords || newPoint, newPoint]
                : [...prev.waypoints, newPoint];
            if (geometry.length >= 2) {
                waypoints = [...waypoints].sort((a, b) => fractionAlongPolyline(a, geometry) - fractionAlongPolyline(b, geometry));
            }
            const depDate = new Date(prev.depDate);
            const info = await recalculateWithWaypoints(waypoints, depDate, prev.originCoords, prev.destCoords, prev.mode);
            if (myRequestId !== routeRequestIdRef.current) return;
            setRouteResult({ ...info, midCoords: undefined });
            setRouteAlternatives([]);
        } catch (e) {
            if (myRequestId !== routeRequestIdRef.current) return;
            console.error(e);
            setError(isNetworkOrTimeoutError(e) ? t('routes.weatherConnectionError') : t('routes.addStopError'));
        } finally {
            if (myRequestId === routeRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    const updateWaypoint = async (index, newLat, newLon) => {
        const prev = routeResult;
        if (!prev?.originCoords || !prev?.destCoords || !prev?.depDate) return;
        const myRequestId = ++routeRequestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            let waypoints;
            if (!prev.waypoints || prev.waypoints.length === 0) {
                waypoints = [{ lat: newLat, lon: newLon }];
            } else {
                waypoints = prev.waypoints.map((w, i) => i === index ? { lat: newLat, lon: newLon } : w);
            }
            const geometry = prev.routeGeometry || [];
            if (geometry.length >= 2) {
                waypoints = [...waypoints].sort((a, b) => fractionAlongPolyline(a, geometry) - fractionAlongPolyline(b, geometry));
            }
            const depDate = new Date(prev.depDate);
            const info = await recalculateWithWaypoints(waypoints, depDate, prev.originCoords, prev.destCoords, prev.mode);
            if (myRequestId !== routeRequestIdRef.current) return;
            setRouteResult({ ...info, midCoords: undefined });
            setRouteAlternatives([]);
        } catch (e) {
            if (myRequestId !== routeRequestIdRef.current) return;
            console.error(e);
            setError(isNetworkOrTimeoutError(e) ? t('routes.weatherConnectionError') : t('routes.updateStopError'));
        } finally {
            if (myRequestId === routeRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    const removeWaypoint = async (index) => {
        const prev = routeResult;
        if (!prev?.originCoords || !prev?.destCoords || !prev?.depDate) return;
        const current = prev.waypoints || [];
        if (current.length <= 0) return;
        const waypoints = current.filter((_, i) => i !== index);
        const depDate = new Date(prev.depDate);
        const myRequestId = ++routeRequestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const info = await analyzeRouteWithWeather(
                prev.originCoords,
                prev.destCoords,
                waypoints,
                depDate,
                prev.mode
            );
            if (myRequestId !== routeRequestIdRef.current) return;
            if (waypoints.length === 0) {
                setRouteAlternatives([]);
                setAlternativeIndex(0);
                setRouteResult(info);
            } else {
                setRouteResult({ ...info, midCoords: undefined });
                setRouteAlternatives([]);
            }
        } catch (e) {
            if (myRequestId !== routeRequestIdRef.current) return;
            console.error(e);
            setError(isNetworkOrTimeoutError(e) ? t('routes.weatherConnectionError') : t('routes.removeStopError'));
        } finally {
            if (myRequestId === routeRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    return {
        calculateRoute,
        routeResult,
        loading,
        error,
        resetRoute,
        addWaypoint,
        updateWaypoint,
        removeWaypoint,
        smartSafeRoute,
        spatialRoute,
        applySpatialRoute,
        originalRouteResult,
        revertToOriginalRoute
    };
};