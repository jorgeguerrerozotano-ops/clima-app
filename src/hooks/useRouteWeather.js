import { useState } from 'react';
import i18n from '../i18n';
import { getRouteData, sanitizeCode, getWeatherInfo, pointAlongRoute, fractionAlongPolyline, getIndexOfCurrentTime } from '../utils/helpers';
import { fetchOpenMeteoForecastRaw, fetchAirQuality, mergeAirQualityIntoHourly } from '../utils/weatherApi';
import { prioritizeFactors, mapFactorsToLegacy } from '../utils/riskUtils';
import { calculateAdversityScore, findBestTimeSlot, findBestSpatialDetour, ADVERSITY_THRESHOLD } from '../utils/smartRouteLogic';
import { evaluateMoto, evaluateCar, evaluateWalk } from '../utils/safetyRules';

// --- HELPER: Extraer pronóstico (Snapshot + Contexto) ---
// Usa "hora actual" (slot que coincide en año/mes/día/hora) cuando se pasa timezone, para alinear con Actividades/Home.
const getForecastAtTime = (hourlyData, targetDateObj, timezone) => {
    if (!hourlyData || !hourlyData.time) return null;
    let closestIndex = -1;
    if (timezone) {
        closestIndex = getIndexOfCurrentTime(hourlyData.time, timezone, targetDateObj);
    }
    if (closestIndex === -1) {
        const targetTime = targetDateObj.getTime();
        let minDiff = Infinity;
        hourlyData.time.forEach((t, i) => {
            const time = new Date(t).getTime();
            const diff = Math.abs(time - targetTime);
            if (diff < minDiff) { minDiff = diff; closestIndex = i; }
        });
    }
    if (closestIndex === -1) return null;

    // Calcular Suelo Mojado (Suma de precipitación de las 2 horas previas)
    let isFloorWet = false;
    if (closestIndex >= 2) {
        const rainSum = hourlyData.precipitation.slice(closestIndex - 2, closestIndex).reduce((a, b) => a + b, 0);
        isFloorWet = rainSum > 0.5;
    }

    const humidity = hourlyData.relative_humidity_2m?.[closestIndex] ?? null;
    const usAqi = hourlyData.us_aqi?.[closestIndex] ?? null;

    return {
        temp: hourlyData.temperature_2m[closestIndex],
        apparentTemp: hourlyData.apparent_temperature?.[closestIndex] ?? null,
        rainProb: hourlyData.precipitation_probability[closestIndex],
        rainMM: hourlyData.precipitation[closestIndex],
        snowCM: hourlyData.snowfall ? hourlyData.snowfall[closestIndex] : 0,
        snowDepth: hourlyData.snow_depth ? hourlyData.snow_depth[closestIndex] : 0,
        windSpeed: hourlyData.wind_speed_10m[closestIndex],
        code: sanitizeCode(hourlyData.weather_code[closestIndex], hourlyData.precipitation[closestIndex], hourlyData.precipitation_probability?.[closestIndex] ?? 100),
        humidity,
        usAqi,
        isFloorWet,
        time: new Date(hourlyData.time[closestIndex]).toLocaleTimeString(i18n.language, {hour:'2-digit', minute:'2-digit'})
    };
};

const t = (k, o) => i18n.t(k, o);

// --- ROUTER LÓGICO (usa evaluadores centralizados en safetyRules) ---
const evaluateSegment = (data, mode) => {
    if (!data) return { status: 'gray', message: t('routes.noDataShort'), sortedFactors: [], factors: [] };
    const result = mode === 'car' ? evaluateCar(data, t) : mode === 'walk' ? evaluateWalk(data, t) : evaluateMoto(data, t);
    const { criticals, warnings, factors } = result;
    let status = 'green';
    let message = t('activities.idealConditions');
    if (criticals.length > 0) { status = 'red'; message = t('routes.criticalAlerts', { count: criticals.length }); }
    else if (warnings.length > 0) { status = 'yellow'; message = t('routes.warningsCount', { count: warnings.length }); }

    const sortedFactors = prioritizeFactors(factors);
    const legacyFactors = mapFactorsToLegacy(sortedFactors);

    let colorClass = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300';
    if (status === 'yellow') colorClass = 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300';
    if (status === 'red') colorClass = 'bg-red-500/10 border-red-500/50 text-red-300';

    return { 
        status, 
        message,
        colorClass, 
        sortedFactors,
        factors: legacyFactors 
    };
};

// === HOOK PRINCIPAL ===
export const useRouteWeather = () => {
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

    // Construir routeResult cuando hay legs (waypoints >= 1)
    const buildResultWithLegs = (routeData, originCoords, destCoords, waypoints, depDate, mode, forecasts, segmentKeys) => {
        const durationMinutes = routeData.durationMin || 0;
        const legs = routeData.legs || [];
        const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);
        const destF = forecasts[forecasts.length - 1];
        const destInfo = getWeatherInfo(destF?.code || 0);
        const segments = {};
        const remainingFromIndex = (idx) => legs.slice(idx).reduce((s, l) => s + (l.distanceKm || 0), 0);
        segmentKeys.forEach((key, i) => {
            const f = forecasts[i];
            const arrivalDate = i === 0 ? depDate : new Date(depDate.getTime() + legs.slice(0, i).reduce((s, l) => s + l.durationMin, 0) * 60000);
            const name = key === 'origin' ? t('routes.departure') : key === 'dest' ? t('routes.arrival') : key === 'mid' ? t('routes.onRoute') : t('routes.onRouteN', { n: segmentKeys.slice(1, -1).indexOf(key) + 1 });
            const remainingKm = key === 'dest' ? 0 : Math.round(remainingFromIndex(i));
            segments[key] = { ...evaluateSegment(f, mode), time: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name, remainingKm };
        });
        return {
            dist: Math.round(parseFloat(routeData.distanceKm)),
            time: durationMinutes >= 60 ? `${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m` : `${durationMinutes}m`,
            durationMinutes,
            destWeather: { temp: destF ? Math.round(destF.temp) + '°' : '--', text: destInfo.label, arrival: arrDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) },
            originWeather: { temp: forecasts[0] ? Math.round(forecasts[0].temp) + '°' : '--' },
            segments,
            waypoints: waypoints || [],
            depDate: depDate.toISOString(),
            originCoords: { lat: originCoords.lat, lon: originCoords.lon },
            destCoords: { lat: destCoords.lat, lon: destCoords.lon },
            mode,
            routeGeometry: routeData.routeGeometry || []
        };
    };

    const buildResultFromRouteData = (routeData, lat1, lon1, lat2, lon2, depDate, mode, originF, destF, midF, midLat, midLon, durationMinutes, arrDate) => {
        const totalKm = parseFloat(routeData.distanceKm);
        const segments = {
            origin: { ...evaluateSegment(originF, mode), time: depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: t('routes.departure'), remainingKm: Math.round(totalKm) },
            mid: { ...evaluateSegment(midF, mode), time: new Date(depDate.getTime() + (durationMinutes / 2) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: t('routes.onRoute'), remainingKm: Math.round(totalKm / 2) },
            dest: { ...evaluateSegment(destF, mode), time: arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: t('routes.arrival'), remainingKm: 0 }
        };
        return {
            dist: Math.round(parseFloat(routeData.distanceKm)),
            time: durationMinutes >= 60 ? `${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m` : `${durationMinutes}m`,
            durationMinutes,
            destWeather: { temp: destF ? Math.round(destF.temp) + '°' : '--', text: getWeatherInfo(destF?.code || 0).label, arrival: arrDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) },
            originWeather: { temp: originF ? Math.round(originF.temp) + '°' : '--' },
            segments,
            waypoints: [],
            midCoords: { lat: midLat, lon: midLon },
            depDate: depDate.toISOString(),
            originCoords: { lat: lat1, lon: lon1 },
            destCoords: { lat: lat2, lon: lon2 },
            mode,
            routeGeometry: routeData.routeGeometry || []
        };
    };

    const calculateRoute = async (origin, dest, mode, departureDateObj, options = {}) => {
        if (!origin || !dest) return;
        setLoading(true);
        setError(null);
        setRouteResult(null);
        setRouteAlternatives([]);
        setAlternativeIndex(0);
        setSmartSafeRoute(null);
        setSpatialRoute(null);
        try {
            const lat1 = parseFloat(origin.lat), lon1 = parseFloat(origin.lon);
            const lat2 = parseFloat(dest.lat), lon2 = parseFloat(dest.lon);
            const depDate = departureDateObj;

            const { routes } = await getRouteData(lat1, lon1, lat2, lon2, mode);
            const routeData = routes?.[0];
            if (!routeData) throw new Error('No routes');

            const geometry = routeData.routeGeometry || [];
            const midOnRoute = geometry.length >= 2 ? pointAlongRoute(geometry, 0.5) : null;
            const midLat = midOnRoute ? midOnRoute.lat : (lat1 + lat2) / 2;
            const midLon = midOnRoute ? midOnRoute.lon : (lon1 + lon2) / 2;
            const durationMinutes = routeData.durationMin || 30;
            const midDate = new Date(depDate.getTime() + (durationMinutes / 2) * 60000);
            const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);

            const [originRaw, destRaw] = await Promise.all([fetchOpenMeteoForecastRaw(lat1, lon1), fetchOpenMeteoForecastRaw(lat2, lon2)]);
            const [originAq, destAq] = await Promise.all([fetchAirQuality(lat1, lon1), fetchAirQuality(lat2, lon2)]);
            const originMerged = mergeAirQualityIntoHourly(originRaw, originAq);
            const destMerged = mergeAirQualityIntoHourly(destRaw, destAq);
            const originF = getForecastAtTime(originMerged.hourly, depDate, originMerged.timezone);

            const [midRaw] = await Promise.all([fetchOpenMeteoForecastRaw(midLat, midLon)]);
            const [midAq] = await Promise.all([fetchAirQuality(midLat, midLon)]);
            const midMerged = mergeAirQualityIntoHourly(midRaw, midAq);
            const midF = getForecastAtTime(midMerged.hourly, midDate, midMerged.timezone);
            const destF = getForecastAtTime(destMerged.hourly, arrDate, destMerged.timezone);

            const primary = buildResultFromRouteData(routeData, lat1, lon1, lat2, lon2, depDate, mode, originF, destF, midF, midLat, midLon, durationMinutes, arrDate);
            setRouteAlternatives([]);
            setAlternativeIndex(0);
            setRouteResult(primary);

            // Smart Safe: buscar mejor hora (Fase 1) y/o desvío espacial (Fase 2) en segundo plano
            if (primary && (!primary.waypoints || primary.waypoints.length === 0)) {
                const adversity = calculateAdversityScore(primary);
                if (adversity > ADVERSITY_THRESHOLD) {
                    const timePromise = findBestTimeSlot(
                        primary,
                        depDate,
                        durationMinutes,
                        { originMerged, destMerged, midMerged },
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
            console.error(e);
            setError("No se pudo calcular la ruta. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const recalculateWithWaypoints = async (waypoints, depDate, originCoords, destCoords, mode, options = {}) => {
        const requestOptions = options?.avoidFerries ? { avoidFerries: true } : undefined;
        const { routes } = await getRouteData(
            originCoords.lat, originCoords.lon,
            destCoords.lat, destCoords.lon,
            mode,
            waypoints,
            requestOptions
        );
        const routeData = routes?.[0];
        if (!routeData?.legs || routeData.legs.length !== waypoints.length + 1) throw new Error("Ruta no válida");
        const legs = routeData.legs;
        const arrivalDates = [depDate];
        let acc = 0;
        legs.forEach((leg) => { acc += leg.durationMin; arrivalDates.push(new Date(depDate.getTime() + acc * 60000)); });
        const coordsList = [
            { lat: originCoords.lat, lon: originCoords.lon },
            ...waypoints.map(w => ({ lat: w.lat, lon: w.lon })),
            { lat: destCoords.lat, lon: destCoords.lon }
        ];
        const rawList = await Promise.all(coordsList.map(c => fetchOpenMeteoForecastRaw(c.lat, c.lon)));
        const aqList = await Promise.all(coordsList.map(c => fetchAirQuality(c.lat, c.lon)));
        const mergedList = rawList.map((raw, i) => mergeAirQualityIntoHourly(raw, aqList[i]));
        const forecasts = arrivalDates.map((d, i) => getForecastAtTime(mergedList[i].hourly, d, mergedList[i].timezone));
        forecasts.forEach((f, i) => { if (f && coordsList[i]) f.coords = coordsList[i]; });
        const segmentKeys = ['origin', ...waypoints.map((_, i) => 'wp' + i), 'dest'];
        return buildResultWithLegs(routeData, originCoords, destCoords, waypoints, depDate, mode, forecasts, segmentKeys);
    };

    const addWaypoint = async (optionalLat, optionalLon) => {
        const prev = routeResult;
        if (!prev?.originCoords || !prev?.destCoords || !prev?.depDate || (prev.waypoints?.length ?? 0) >= 3) return;
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
            setRouteResult({ ...info, midCoords: undefined });
            setRouteAlternatives([]);
        } catch (e) {
            console.error(e);
            const msg = e?.message || '';
            const isNetworkOrTimeout = msg.includes('Timeout') || msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('CORS') || msg.includes('504');
            setError(isNetworkOrTimeout ? t('routes.weatherConnectionError') : t('routes.addStopError'));
        } finally {
            setLoading(false);
        }
    };

    const updateWaypoint = async (index, newLat, newLon) => {
        const prev = routeResult;
        if (!prev?.originCoords || !prev?.destCoords || !prev?.depDate) return;
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
            setRouteResult({ ...info, midCoords: undefined });
            setRouteAlternatives([]);
        } catch (e) {
            console.error(e);
            const msg = e?.message || '';
            const isNetworkOrTimeout = msg.includes('Timeout') || msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('CORS') || msg.includes('504');
            setError(isNetworkOrTimeout ? t('routes.weatherConnectionError') : t('routes.updateStopError'));
        } finally {
            setLoading(false);
        }
    };

    const removeWaypoint = async (index) => {
        const prev = routeResult;
        if (!prev?.originCoords || !prev?.destCoords || !prev?.depDate) return;
        setLoading(true);
        setError(null);
        try {
            const current = prev.waypoints || [];
            if (current.length <= 0) return;
            const waypoints = current.filter((_, i) => i !== index);
            const depDate = new Date(prev.depDate);
            if (waypoints.length === 0) {
                const { routes } = await getRouteData(prev.originCoords.lat, prev.originCoords.lon, prev.destCoords.lat, prev.destCoords.lon, prev.mode);
                const routeData = routes?.[0];
                if (!routeData) throw new Error("Ruta no encontrada");
                const geometry = routeData.routeGeometry || [];
                const midOnRoute = geometry.length >= 2 ? pointAlongRoute(geometry, 0.5) : null;
                const midLat = midOnRoute ? midOnRoute.lat : (prev.originCoords.lat + prev.destCoords.lat) / 2;
                const midLon = midOnRoute ? midOnRoute.lon : (prev.originCoords.lon + prev.destCoords.lon) / 2;
                const durationMinutes = routeData.durationMin || 30;
                const midDate = new Date(depDate.getTime() + (durationMinutes / 2) * 60000);
                const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);
                const [originRaw, destRaw, midRaw] = await Promise.all([
                    fetchOpenMeteoForecastRaw(prev.originCoords.lat, prev.originCoords.lon),
                    fetchOpenMeteoForecastRaw(prev.destCoords.lat, prev.destCoords.lon),
                    fetchOpenMeteoForecastRaw(midLat, midLon)
                ]);
                const [originAq, destAq, midAq] = await Promise.all([
                    fetchAirQuality(prev.originCoords.lat, prev.originCoords.lon),
                    fetchAirQuality(prev.destCoords.lat, prev.destCoords.lon),
                    fetchAirQuality(midLat, midLon)
                ]);
                const originMerged = mergeAirQualityIntoHourly(originRaw, originAq);
                const destMerged = mergeAirQualityIntoHourly(destRaw, destAq);
                const midMerged = mergeAirQualityIntoHourly(midRaw, midAq);
                const originF = getForecastAtTime(originMerged.hourly, depDate, originMerged.timezone);
                const midF = getForecastAtTime(midMerged.hourly, midDate, midMerged.timezone);
                const destF = getForecastAtTime(destMerged.hourly, arrDate, destMerged.timezone);
                const segments = {
                    origin: { ...evaluateSegment(originF, prev.mode), time: depDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }), name: t('routes.departure') },
                    mid: { ...evaluateSegment(midF, prev.mode), time: midDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }), name: t('routes.onRouteN', { n: 1 }) },
                    dest: { ...evaluateSegment(destF, prev.mode), time: arrDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }), name: t('routes.arrival') }
                };
                const info = {
                    dist: Math.round(parseFloat(routeData.distanceKm)),
                    time: durationMinutes >= 60 ? `${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m` : `${durationMinutes}m`,
                    durationMinutes,
                    destWeather: { temp: destF ? Math.round(destF.temp) + '°' : '--', text: getWeatherInfo(destF?.code || 0).label, arrival: arrDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) },
                    originWeather: { temp: originF ? Math.round(originF.temp) + '°' : '--' },
                    segments,
                    waypoints: [],
                    midCoords: { lat: midLat, lon: midLon },
                    depDate: prev.depDate,
                    originCoords: prev.originCoords,
                    destCoords: prev.destCoords,
                    mode: prev.mode,
                    routeGeometry: routeData.routeGeometry || []
                };
                setRouteAlternatives([info]);
                setAlternativeIndex(0);
                setRouteResult(info);
            } else {
                const info = await recalculateWithWaypoints(waypoints, depDate, prev.originCoords, prev.destCoords, prev.mode);
                setRouteResult({ ...info, midCoords: undefined });
                setRouteAlternatives([]);
            }
        } catch (e) {
            console.error(e);
            setError("No se pudo quitar la parada.");
        } finally {
            setLoading(false);
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