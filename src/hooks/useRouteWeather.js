import { useState } from 'react';
import i18n from '../i18n';
import { getRouteData, sanitizeCode, getWeatherInfo, pointAlongRoute, fractionAlongPolyline, getIndexOfCurrentTime } from '../utils/helpers';
import { prioritizeFactors, mapFactorsToLegacy } from '../utils/riskUtils';

// Estándares de Recomendación Climática — Rutas
const ROUTE_LIMITS = {
    MOTO_WIND_WARNING: 30,
    MOTO_WIND_CRITICAL: 45,
    MOTO_TEMP_WARNING: 5,
    MOTO_TEMP_CRITICAL: 2,
    MOTO_RAIN_WARNING_MAX: 0.5,
    MOTO_RAIN_ACTIVE_MM: 0.5,
    MOTO_RAIN_CRITICAL: 4.0,
    HEAT_WARNING: 30,
    HEAT_CRITICAL: 35,
    CAR_RAIN_WARNING: 2.5,
    CAR_RAIN_CRITICAL: 7.6,
    CAR_WIND_WARNING: 60,
    CAR_WIND_CRITICAL: 90,
    CAR_VIS_WARNING_M: 500,
    CAR_VIS_CRITICAL_M: 50,
    WALK_RAIN_WARNING: 0.5,
    WALK_RAIN_CRITICAL: 4.0,
    WALK_WIND_WARNING: 25,
    WALK_WIND_CRITICAL: 40,
    WALK_HEAT_CRITICAL: 35,
    HUMIDITY_WARNING: 70,
    HUMIDITY_CRITICAL: 85,
    AQI_CRITICAL: 150
};

/** Crea un factor estandarizado: type, value, status, label, description, score */
const createFactor = (type, value, status, label, description = '', score = 0) => ({
    type, value, status, label, description, score
});

// --- HELPER: Petición a la API (con timeout y un reintento ante fallo) ---
const FETCH_WEATHER_TIMEOUT_MS = 15000;

const fetchRawAPI = async (lat, lon, retries = 1) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth,relative_humidity_2m&timezone=auto`;
    const attempt = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_WEATHER_TIMEOUT_MS);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.reason || `Error ${res.status}`);
            if (data?.error) throw new Error(data.reason || 'Servicio no disponible');
            if (!data?.hourly?.time?.length) throw new Error('Datos incompletos');
            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') throw new Error('Timeout al obtener el tiempo');
            throw err;
        }
    };
    try {
        return await attempt();
    } catch (err) {
        if (retries > 0) return attempt();
        throw err;
    }
};

// --- HELPER: API Calidad del Aire (si falla, no bloquea) ---
const fetchAirQuality = async (lat, lon) => {
    try {
        const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto`);
        const aq = await res.json();
        if (!res.ok || aq?.error || !aq?.hourly?.time?.length) return null;
        return aq;
    } catch (e) { return null; }
};

// --- Combina us_aqi en datos hourly por timestamp ---
const mergeAirQualityIntoHourly = (data, aqData) => {
    if (!aqData?.hourly?.us_aqi || !data?.hourly?.time?.length) return data;
    const aqByTime = new Map();
    (aqData.hourly.time || []).forEach((t, i) => { aqByTime.set(t, aqData.hourly.us_aqi[i]); });
    const us_aqi = data.hourly.time.map(t => aqByTime.get(t) ?? null);
    return { ...data, hourly: { ...data.hourly, us_aqi } };
};

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

const evaluateMotoLike = (data) => {
    const { temp, apparentTemp, rainMM, snowCM, snowDepth, windSpeed, isFloorWet, code, humidity, usAqi } = data;
    const tempToUse = apparentTemp != null ? apparentTemp : temp;
    const tempLabel = apparentTemp != null ? t('common.sensation') : t('common.temp');
    const isSnow = snowCM > 0;
    let criticals = []; let warnings = [];

    let fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'SAFE', tempLabel, '', 0);
    if (tempToUse >= ROUTE_LIMITS.HEAT_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'CRITICAL', tempLabel, t('activities.heatStrokeRisk'), 95); criticals.push(t('activities.heatStrokeRisk')); }
    else if (tempToUse >= ROUTE_LIMITS.HEAT_WARNING) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'WARNING', tempLabel, t('activities.excessiveHeat'), 60); warnings.push(t('activities.excessiveHeat')); }
    else if (tempToUse < ROUTE_LIMITS.MOTO_TEMP_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'CRITICAL', tempLabel, t('activities.iceRisk'), 95); criticals.push(t('activities.iceRisk')); }
    else if (tempToUse < ROUTE_LIMITS.MOTO_TEMP_WARNING) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'WARNING', tempLabel, t('activities.intenseCold'), 50); warnings.push(t('activities.intenseCold')); }

    let fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (windSpeed > ROUTE_LIMITS.MOTO_WIND_CRITICAL) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'CRITICAL', t('activities.wind'), t('activities.dangerousWind'), 100); criticals.push(t('activities.dangerousWind')); }
    else if (windSpeed > ROUTE_LIMITS.MOTO_WIND_WARNING) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'WARNING', t('activities.wind'), t('activities.annoyingWind'), 55); warnings.push(t('activities.annoyingWind')); }

    let fRoad = createFactor('ROAD', t('activities.dryRoad'), 'SAFE', t('activities.road'), '', 0);
    if (snowDepth > 0 || isSnow) {
        fRoad = createFactor('ROAD', snowDepth > 0 ? `${Math.round(snowDepth * 100)}cm` : `${snowCM}cm`, 'CRITICAL', t('weather.snow'), t('activities.snowOnRoad'), 100);
        criticals.push(t('activities.snowOnRoad'));
    } else if (rainMM > ROUTE_LIMITS.MOTO_RAIN_CRITICAL) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.raining'), t('activities.activePrecip'), 95);
        criticals.push(t('activities.activePrecip'));
    } else if (rainMM >= ROUTE_LIMITS.MOTO_RAIN_ACTIVE_MM) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.raining'), t('activities.activePrecip'), 95);
        criticals.push(t('activities.activePrecip'));
    } else if (rainMM >= 0.1) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'WARNING', t('activities.raining'), t('activities.rainRisk', { name: t('activities.rain') }), 60);
        warnings.push(t('activities.rainRisk', { name: t('activities.rain') }));
    } else if (isFloorWet) {
        fRoad = createFactor('ROAD', t('activities.wetRoad'), 'WARNING', t('activities.road'), t('activities.wetAsphalt'), 40);
        warnings.push(t('activities.wetAsphalt'));
    }

    const precipValue = rainMM === 0 ? '0 mm' : `${Number(rainMM).toFixed(1)} mm`;
    const fPrecip = createFactor('PRECIP', precipValue, 'SAFE', t('activities.rain'), '', 0);
    const roadShowsRainMm = rainMM >= 0.1;

    let fVis = createFactor('VISIBILITY', t('activities.good'), 'SAFE', t('activities.visibility'), '', 0);
    if (code === 48) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'CRITICAL', t('activities.visibility'), t('activities.veryPoorVisibility'), 100); criticals.push(t('activities.veryPoorVisibility')); }
    else if (code === 45) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'WARNING', t('activities.visibility'), t('activities.reducedVisibility'), 70); warnings.push(t('activities.reducedVisibility')); }
    else if (rainMM > 2.0 || isSnow) { fVis = createFactor('VISIBILITY', t('activities.regular'), 'WARNING', t('activities.visibility'), t('activities.regular'), 45); warnings.push(t('activities.regular')); }

    const factors = roadShowsRainMm ? [fTemp, fWind, fRoad, fVis] : [fTemp, fWind, fRoad, fPrecip, fVis];

    if (humidity != null && tempToUse > 25) {
        const humStatus = humidity > ROUTE_LIMITS.HUMIDITY_CRITICAL ? 'CRITICAL' : humidity > ROUTE_LIMITS.HUMIDITY_WARNING ? 'WARNING' : 'SAFE';
        if (humStatus === 'CRITICAL') criticals.push(t('activities.highHumidity'));
        else if (humStatus === 'WARNING') warnings.push(t('activities.highHumidity'));
        factors.push(createFactor('HUMIDITY', `${Math.round(humidity)}%`, humStatus, t('activities.humidity'), humStatus !== 'SAFE' ? t('activities.highHumidity') : '', humStatus === 'CRITICAL' ? 70 : 40));
    }
    if (usAqi != null) {
        const aqiStatus = usAqi > ROUTE_LIMITS.AQI_CRITICAL ? 'CRITICAL' : 'SAFE';
        if (aqiStatus === 'CRITICAL') criticals.push(t('activities.poorAirQuality'));
        factors.push(createFactor('AQI', String(usAqi), aqiStatus, 'AQI', aqiStatus === 'CRITICAL' ? t('activities.poorAirQuality') : '', aqiStatus === 'CRITICAL' ? 75 : 0));
    }

    return { criticals, warnings, factors };
};

const evaluateCar = (data) => {
    const { temp, rainMM, snowCM, snowDepth, windSpeed, code, isFloorWet } = data;
    const isSnow = snowCM > 0;
    const iceRisk = temp < 0 && (rainMM > 0 || isFloorWet);
    let criticals = []; let warnings = [];

    let fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'SAFE', t('common.temp'), '', 0);
    if (iceRisk) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'CRITICAL', t('common.temp'), t('routes.severeIce'), 95); criticals.push(t('routes.severeIce')); }
    else if (temp < 0) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'WARNING', t('common.temp'), t('routes.possibleIce'), 50); warnings.push(t('routes.possibleIce')); }

    let fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (windSpeed > ROUTE_LIMITS.CAR_WIND_CRITICAL) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'CRITICAL', t('activities.wind'), t('routes.hurricaneWind'), 100); criticals.push(t('routes.hurricaneWind')); }
    else if (windSpeed > ROUTE_LIMITS.CAR_WIND_WARNING) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'WARNING', t('activities.wind'), t('activities.strongWind'), 65); warnings.push(t('activities.strongWind')); }

    let fRoad = createFactor('ROAD', t('activities.dry'), 'SAFE', t('activities.rain'), '', 0);
    if (snowDepth > 0) {
        fRoad = createFactor('ROAD', `${Math.round(snowDepth * 100)}cm`, 'CRITICAL', t('weather.snow'), t('routes.snowyRoad'), 100);
        criticals.push(t('routes.snowyRoad'));
    } else if (isSnow) {
        fRoad = createFactor('ROAD', `${snowCM}cm`, 'CRITICAL', t('weather.snow'), t('activities.snowing'), 95);
        criticals.push(t('activities.snowing'));
    } else if (rainMM > ROUTE_LIMITS.CAR_RAIN_CRITICAL) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.rain'), t('routes.torrentialRain'), 90);
        criticals.push(t('routes.torrentialRain'));
    } else if (rainMM > ROUTE_LIMITS.CAR_RAIN_WARNING) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'WARNING', t('activities.rain'), t('routes.rainOnRoute'), 60);
        warnings.push(t('routes.rainOnRoute'));
    } else if (rainMM > 0) {
        fRoad = createFactor('ROAD', t('weather.drizzle'), 'SAFE', t('activities.rain'), '', 0);
    }

    const precipValueCar = rainMM === 0 ? '0 mm' : `${Number(rainMM).toFixed(1)} mm`;
    const fPrecipCar = createFactor('PRECIP', precipValueCar, 'SAFE', t('activities.rain'), '', 0);
    const roadShowsRainMmCar = rainMM > ROUTE_LIMITS.CAR_RAIN_WARNING;

    let fVis = createFactor('VISIBILITY', t('activities.good'), 'SAFE', t('activities.visibility'), '', 0);
    if (code === 48) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'CRITICAL', t('activities.visibility'), t('routes.noVisibility'), 100); criticals.push(t('routes.noVisibility')); }
    else if (code === 45) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'WARNING', t('activities.visibility'), t('routes.denseFog'), 70); warnings.push(t('routes.denseFog')); }
    else if (rainMM > 10) { fVis = createFactor('VISIBILITY', t('routes.poor'), 'CRITICAL', t('activities.visibility'), t('routes.noVisibility'), 90); criticals.push(t('routes.noVisibility')); }

    const factorsCar = roadShowsRainMmCar ? [fTemp, fWind, fRoad, fVis] : [fTemp, fWind, fRoad, fPrecipCar, fVis];
    return { criticals, warnings, factors: factorsCar };
};

const evaluateWalk = (data) => {
    const { temp, rainMM, snowCM, windSpeed, isFloorWet, humidity, usAqi } = data;
    const isSnow = snowCM > 0;
    const iceGround = temp < 0 && (rainMM > 0 || isFloorWet);
    let criticals = []; let warnings = [];

    let fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'SAFE', t('common.temp'), '', 0);
    if (temp > ROUTE_LIMITS.WALK_HEAT_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'CRITICAL', t('common.temp'), t('activities.heatStrokeRisk'), 95); criticals.push(t('activities.heatStrokeRisk')); }
    else if (temp < -5) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'CRITICAL', t('common.temp'), t('activities.dangerCold'), 90); criticals.push(t('activities.dangerCold')); }
    else if (temp < 5) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'WARNING', t('common.temp'), t('activities.intenseCold'), 50); warnings.push(t('activities.intenseCold')); }

    const pName = isSnow ? t('weather.snow') : t('activities.rain');
    const pVal = isSnow ? `${snowCM}cm` : `${rainMM}mm`;
    let fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'SAFE', pName, '', 0);
    if (rainMM > ROUTE_LIMITS.WALK_RAIN_CRITICAL || isSnow) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'CRITICAL', pName, isSnow ? t('rain.heavySnow') : t('weather.rainHeavy'), 85); criticals.push(isSnow ? t('rain.heavySnow') : t('weather.rainHeavy')); }
    else if (rainMM > ROUTE_LIMITS.WALK_RAIN_WARNING) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'WARNING', pName, t('activities.rain'), 55); warnings.push(t('activities.rain')); }
    else if (rainMM > 0) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'WARNING', pName, t('weather.drizzle'), 30); warnings.push(t('weather.drizzle')); }

    let fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (windSpeed > ROUTE_LIMITS.WALK_WIND_CRITICAL) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'CRITICAL', t('activities.wind'), t('activities.strongWind'), 85); criticals.push(t('activities.strongWind')); }
    else if (windSpeed > ROUTE_LIMITS.WALK_WIND_WARNING) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'WARNING', t('activities.wind'), t('activities.annoyingWind'), 50); warnings.push(t('activities.annoyingWind')); }

    let fSoil = createFactor('GROUND', isFloorWet ? t('activities.wet') : t('activities.dry'), 'SAFE', t('activities.ground'), '', 0);
    if (iceGround) { fSoil = createFactor('GROUND', t('activities.iceRisk'), 'CRITICAL', t('activities.ground'), t('activities.iceOnGround'), 100); criticals.push(t('activities.iceOnGround')); }
    else if (isFloorWet) { fSoil = createFactor('GROUND', t('activities.wet'), 'WARNING', t('activities.ground'), t('activities.wetGround'), 40); warnings.push(t('activities.wetGround')); }

    const factors = [fTemp, fPrecip, fWind, fSoil];

    if (humidity != null && temp > 20) {
        const humStatus = humidity > ROUTE_LIMITS.HUMIDITY_CRITICAL ? 'CRITICAL' : humidity > ROUTE_LIMITS.HUMIDITY_WARNING ? 'WARNING' : 'SAFE';
        if (humStatus === 'CRITICAL') criticals.push(t('activities.highHumidity'));
        else if (humStatus === 'WARNING') warnings.push(t('activities.highHumidity'));
        factors.push(createFactor('HUMIDITY', `${Math.round(humidity)}%`, humStatus, t('activities.humidity'), humStatus !== 'SAFE' ? t('activities.highHumidity') : '', humStatus === 'CRITICAL' ? 70 : 40));
    }
    if (usAqi != null) {
        const aqiStatus = usAqi > ROUTE_LIMITS.AQI_CRITICAL ? 'CRITICAL' : 'SAFE';
        if (aqiStatus === 'CRITICAL') criticals.push(t('activities.poorAirQuality'));
        factors.push(createFactor('AQI', String(usAqi), aqiStatus, 'AQI', aqiStatus === 'CRITICAL' ? t('activities.poorAirQuality') : '', aqiStatus === 'CRITICAL' ? 75 : 0));
    }

    return { criticals, warnings, factors };
};

// --- ROUTER LÓGICO ---
const evaluateSegment = (data, mode) => {
    if (!data) return { status: 'gray', message: t('routes.noDataShort'), sortedFactors: [], factors: [] };
    let result;
    if (mode === 'car') result = evaluateCar(data);
    else if (mode === 'walk') result = evaluateWalk(data);
    else result = evaluateMotoLike(data);
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

    const resetRoute = () => {
        setRouteResult(null);
        setRouteAlternatives([]);
        setAlternativeIndex(0);
        setError(null);
    };

    const cycleAlternative = () => {
        if (routeAlternatives.length <= 1) return;
        const next = (alternativeIndex + 1) % routeAlternatives.length;
        setAlternativeIndex(next);
        setRouteResult(routeAlternatives[next]);
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
            const name = key === 'origin' ? 'Salida' : key === 'dest' ? 'Llegada' : key === 'mid' ? 'En ruta 1' : `En ruta ${segmentKeys.slice(1, -1).indexOf(key) + 1}`;
            const remainingKm = key === 'dest' ? 0 : Math.round(remainingFromIndex(i));
            segments[key] = { ...evaluateSegment(f, mode), time: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name, remainingKm };
        });
        return {
            dist: Math.round(parseFloat(routeData.distanceKm)),
            time: durationMinutes >= 60 ? `${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m` : `${durationMinutes}m`,
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
            origin: { ...evaluateSegment(originF, mode), time: depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: 'Salida', remainingKm: Math.round(totalKm) },
            mid: { ...evaluateSegment(midF, mode), time: new Date(depDate.getTime() + (durationMinutes / 2) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: 'En ruta 1', remainingKm: Math.round(totalKm / 2) },
            dest: { ...evaluateSegment(destF, mode), time: arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), name: 'Llegada', remainingKm: 0 }
        };
        return {
            dist: Math.round(parseFloat(routeData.distanceKm)),
            time: durationMinutes >= 60 ? `${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m` : `${durationMinutes}m`,
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

    const calculateRoute = async (origin, dest, mode, departureDateObj) => {
        if (!origin || !dest) return;
        setLoading(true);
        setError(null);
        setRouteResult(null);
        setRouteAlternatives([]);
        setAlternativeIndex(0);
        try {
            const lat1 = parseFloat(origin.lat), lon1 = parseFloat(origin.lon);
            const lat2 = parseFloat(dest.lat), lon2 = parseFloat(dest.lon);
            const depDate = departureDateObj;

            const { routes } = await getRouteData(lat1, lon1, lat2, lon2, mode);
            const alternatives = [];

            const [originRaw, destRaw] = await Promise.all([fetchRawAPI(lat1, lon1), fetchRawAPI(lat2, lon2)]);
            const [originAq, destAq] = await Promise.all([fetchAirQuality(lat1, lon1), fetchAirQuality(lat2, lon2)]);
            const originMerged = mergeAirQualityIntoHourly(originRaw, originAq);
            const destMerged = mergeAirQualityIntoHourly(destRaw, destAq);
            const originF = getForecastAtTime(originMerged.hourly, depDate, originMerged.timezone);

            for (const routeData of routes) {
                const geometry = routeData.routeGeometry || [];
                const midOnRoute = geometry.length >= 2 ? pointAlongRoute(geometry, 0.5) : null;
                const midLat = midOnRoute ? midOnRoute.lat : (lat1 + lat2) / 2;
                const midLon = midOnRoute ? midOnRoute.lon : (lon1 + lon2) / 2;
                const durationMinutes = routeData.durationMin || 30;
                const midDate = new Date(depDate.getTime() + (durationMinutes / 2) * 60000);
                const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);

                const [midRaw] = await Promise.all([fetchRawAPI(midLat, midLon)]);
                const [midAq] = await Promise.all([fetchAirQuality(midLat, midLon)]);
                const midMerged = mergeAirQualityIntoHourly(midRaw, midAq);
                const midF = getForecastAtTime(midMerged.hourly, midDate, midMerged.timezone);
                const destF = getForecastAtTime(destMerged.hourly, arrDate, destMerged.timezone);

                const info = buildResultFromRouteData(routeData, lat1, lon1, lat2, lon2, depDate, mode, originF, destF, midF, midLat, midLon, durationMinutes, arrDate);
                alternatives.push(info);
            }

            setRouteAlternatives(alternatives);
            setAlternativeIndex(0);
            setRouteResult(alternatives[0]);
        } catch (e) {
            console.error(e);
            setError("No se pudo calcular la ruta. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    /** Resetea waypoints y recarga las 3 alternativas origen–destino (como recalcular sin paradas). */
    const resetWaypointsAndLoadAlternatives = async () => {
        const prev = routeResult;
        if (!prev?.originCoords || !prev?.destCoords || !prev?.depDate) return;
        setLoading(true);
        setError(null);
        try {
            const lat1 = prev.originCoords.lat, lon1 = prev.originCoords.lon;
            const lat2 = prev.destCoords.lat, lon2 = prev.destCoords.lon;
            const depDate = new Date(prev.depDate);
            const mode = prev.mode;

            const { routes } = await getRouteData(lat1, lon1, lat2, lon2, mode);
            const alternatives = [];

            const [originRaw, destRaw] = await Promise.all([fetchRawAPI(lat1, lon1), fetchRawAPI(lat2, lon2)]);
            const [originAq, destAq] = await Promise.all([fetchAirQuality(lat1, lon1), fetchAirQuality(lat2, lon2)]);
            const originMerged = mergeAirQualityIntoHourly(originRaw, originAq);
            const destMerged = mergeAirQualityIntoHourly(destRaw, destAq);
            const originF = getForecastAtTime(originMerged.hourly, depDate, originMerged.timezone);

            for (const routeData of routes) {
                const geometry = routeData.routeGeometry || [];
                const midOnRoute = geometry.length >= 2 ? pointAlongRoute(geometry, 0.5) : null;
                const midLat = midOnRoute ? midOnRoute.lat : (lat1 + lat2) / 2;
                const midLon = midOnRoute ? midOnRoute.lon : (lon1 + lon2) / 2;
                const durationMinutes = routeData.durationMin || 30;
                const midDate = new Date(depDate.getTime() + (durationMinutes / 2) * 60000);
                const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);

                const [midRaw] = await Promise.all([fetchRawAPI(midLat, midLon)]);
                const [midAq] = await Promise.all([fetchAirQuality(midLat, midLon)]);
                const midMerged = mergeAirQualityIntoHourly(midRaw, midAq);
                const midF = getForecastAtTime(midMerged.hourly, midDate, midMerged.timezone);
                const destF = getForecastAtTime(destMerged.hourly, arrDate, destMerged.timezone);

                const info = buildResultFromRouteData(routeData, lat1, lon1, lat2, lon2, depDate, mode, originF, destF, midF, midLat, midLon, durationMinutes, arrDate);
                alternatives.push(info);
            }

            setRouteAlternatives(alternatives);
            setAlternativeIndex(0);
            setRouteResult(alternatives[0]);
        } catch (e) {
            console.error(e);
            setError("No se pudo cargar alternativas. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const recalculateWithWaypoints = async (waypoints, depDate, originCoords, destCoords, mode) => {
        const { routes } = await getRouteData(
            originCoords.lat, originCoords.lon,
            destCoords.lat, destCoords.lon,
            mode,
            waypoints
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
        const rawList = await Promise.all(coordsList.map(c => fetchRawAPI(c.lat, c.lon)));
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
                    fetchRawAPI(prev.originCoords.lat, prev.originCoords.lon),
                    fetchRawAPI(prev.destCoords.lat, prev.destCoords.lon),
                    fetchRawAPI(midLat, midLon)
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
        cycleAlternative,
        resetWaypointsAndLoadAlternatives,
        hasAlternatives: routeAlternatives.length > 1,
        alternativeIndex,
        alternativesCount: routeAlternatives.length
    };
};