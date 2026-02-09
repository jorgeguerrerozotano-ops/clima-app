/**
 * routeWeatherAnalysis.js — Obtención y análisis de clima en ruta.
 * Función unificada reutilizable: tanto el cálculo inicial como la actualización
 * de waypoints consumen analyzeRouteWithWeather.
 */

import i18n from '../i18n';
import { getRouteData, pointAlongRoute, fractionAlongPolyline } from './routeUtils';
import { getIndexOfCurrentTime, sanitizeCode, getWeatherInfo } from './helpers';
import { fetchOpenMeteoForecastRaw, fetchAirQuality, mergeAirQualityIntoHourly } from './weatherApi';
import { prioritizeFactors, mapFactorsToLegacy } from './riskUtils';
import { evaluateMoto, evaluateCar, evaluateWalk } from './safetyRules';

const t = (k, o) => i18n.t(k, o);

/**
 * Pronóstico en un instante dado a partir de datos horarios (snapshot + contexto).
 */
export function getForecastAtTime(hourlyData, targetDateObj, timezone) {
  if (!hourlyData || !hourlyData.time) return null;
  let closestIndex = -1;
  if (timezone) {
    closestIndex = getIndexOfCurrentTime(hourlyData.time, timezone, targetDateObj);
  }
  if (closestIndex === -1) {
    const targetTime = targetDateObj.getTime();
    let minDiff = Infinity;
    hourlyData.time.forEach((tim, i) => {
      const time = new Date(tim).getTime();
      const diff = Math.abs(time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    });
  }
  if (closestIndex === -1) return null;

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
    code: sanitizeCode(
      hourlyData.weather_code[closestIndex],
      hourlyData.precipitation[closestIndex],
      hourlyData.precipitation_probability?.[closestIndex] ?? 100
    ),
    humidity,
    usAqi,
    isFloorWet,
    time: new Date(hourlyData.time[closestIndex]).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Evalúa un segmento (pronóstico) según modo de transporte.
 */
export function evaluateSegment(data, mode) {
  if (!data) return { status: 'gray', message: t('routes.noDataShort'), sortedFactors: [], factors: [] };
  const result = mode === 'car' ? evaluateCar(data, t) : mode === 'walk' ? evaluateWalk(data, t) : evaluateMoto(data, t);
  const { criticals, warnings, factors } = result;
  let status = 'green';
  let message = t('activities.idealConditions');
  if (criticals.length > 0) {
    status = 'red';
    message = t('routes.criticalAlerts', { count: criticals.length });
  } else if (warnings.length > 0) {
    status = 'yellow';
    message = t('routes.warningsCount', { count: warnings.length });
  }

  const sortedFactors = prioritizeFactors(factors);
  const legacyFactors = mapFactorsToLegacy(sortedFactors);

  let colorClass = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300';
  if (status === 'yellow') colorClass = 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300';
  if (status === 'red') colorClass = 'bg-red-500/10 border-red-500/50 text-red-300';

  return { status, message, colorClass, sortedFactors, factors: legacyFactors };
}

function buildResultFromRouteData(routeData, lat1, lon1, lat2, lon2, depDate, mode, originF, destF, midF, midLat, midLon, durationMinutes, arrDate) {
  const totalKm = parseFloat(routeData.distanceKm);
  const segments = {
    origin: {
      ...evaluateSegment(originF, mode),
      time: depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      name: t('routes.departure'),
      remainingKm: Math.round(totalKm),
    },
    mid: {
      ...evaluateSegment(midF, mode),
      time: new Date(depDate.getTime() + (durationMinutes / 2) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      name: t('routes.onRoute'),
      remainingKm: Math.round(totalKm / 2),
    },
    dest: {
      ...evaluateSegment(destF, mode),
      time: arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      name: t('routes.arrival'),
      remainingKm: 0,
    },
  };
  return {
    dist: Math.round(parseFloat(routeData.distanceKm)),
    time: durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : `${durationMinutes}m`,
    durationMinutes,
    destWeather: {
      temp: destF ? Math.round(destF.temp) + '°' : '--',
      text: getWeatherInfo(destF?.code || 0).label,
      arrival: arrDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
    },
    originWeather: { temp: originF ? Math.round(originF.temp) + '°' : '--' },
    segments,
    waypoints: [],
    midCoords: { lat: midLat, lon: midLon },
    depDate: depDate.toISOString(),
    originCoords: { lat: lat1, lon: lon1 },
    destCoords: { lat: lat2, lon: lon2 },
    mode,
    routeGeometry: routeData.routeGeometry || [],
  };
}

function buildResultWithLegs(routeData, originCoords, destCoords, waypoints, depDate, mode, forecasts, segmentKeys) {
  const durationMinutes = routeData.durationMin || 0;
  const legs = routeData.legs || [];
  const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);
  const destF = forecasts[forecasts.length - 1];
  const destInfo = getWeatherInfo(destF?.code || 0);
  const segments = {};
  const remainingFromIndex = (idx) => legs.slice(idx).reduce((s, l) => s + (l.distanceKm || 0), 0);
  segmentKeys.forEach((key, i) => {
    const f = forecasts[i];
    const arrivalDate =
      i === 0 ? depDate : new Date(depDate.getTime() + legs.slice(0, i).reduce((s, l) => s + l.durationMin, 0) * 60000);
    const name =
      key === 'origin'
        ? t('routes.departure')
        : key === 'dest'
          ? t('routes.arrival')
          : key === 'mid'
            ? t('routes.onRoute')
            : t('routes.onRouteN', { n: segmentKeys.slice(1, -1).indexOf(key) + 1 });
    const remainingKm = key === 'dest' ? 0 : Math.round(remainingFromIndex(i));
    segments[key] = {
      ...evaluateSegment(f, mode),
      time: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      name,
      remainingKm,
    };
  });
  return {
    dist: Math.round(parseFloat(routeData.distanceKm)),
    time: durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : `${durationMinutes}m`,
    durationMinutes,
    destWeather: {
      temp: destF ? Math.round(destF.temp) + '°' : '--',
      text: destInfo.label,
      arrival: arrDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
    },
    originWeather: { temp: forecasts[0] ? Math.round(forecasts[0].temp) + '°' : '--' },
    segments,
    waypoints: waypoints || [],
    depDate: depDate.toISOString(),
    originCoords: { lat: originCoords.lat, lon: originCoords.lon },
    destCoords: { lat: destCoords.lat, lon: destCoords.lon },
    mode,
    routeGeometry: routeData.routeGeometry || [],
  };
}

/**
 * Obtiene la ruta, pronósticos en cada punto y devuelve el análisis completo (mismo formato que RouteView espera).
 * Unifica el cálculo inicial (sin waypoints) y la actualización al añadir/quitar waypoints.
 *
 * @param {{ lat: number, lon: number }} originCoords
 * @param {{ lat: number, lon: number }} destCoords
 * @param {Array<{ lat: number, lon: number }>} waypoints
 * @param {Date} depDate
 * @param {string} mode - 'moto' | 'car' | 'walk' | 'bicycle'
 * @param {{ avoidFerries?: boolean, returnMergedForSmartSafe?: boolean }} [requestOptions]
 * @returns {Promise<Object>} routeResult; si returnMergedForSmartSafe y sin waypoints, { routeResult, originMerged, destMerged, midMerged }
 */
export async function analyzeRouteWithWeather(originCoords, destCoords, waypoints, depDate, mode, requestOptions = {}) {
  const lat1 = parseFloat(originCoords.lat);
  const lon1 = parseFloat(originCoords.lon);
  const lat2 = parseFloat(destCoords.lat);
  const lon2 = parseFloat(destCoords.lon);
  const opts = requestOptions?.avoidFerries ? { avoidFerries: true } : {};
  const returnMerged = requestOptions?.returnMergedForSmartSafe === true;

  const { routes } = await getRouteData(lat1, lon1, lat2, lon2, mode, waypoints, opts);
  const routeData = routes?.[0];
  if (!routeData) throw new Error('No routes');

  if (!waypoints || waypoints.length === 0) {
    const geometry = routeData.routeGeometry || [];
    const midOnRoute = geometry.length >= 2 ? pointAlongRoute(geometry, 0.5) : null;
    const midLat = midOnRoute ? midOnRoute.lat : (lat1 + lat2) / 2;
    const midLon = midOnRoute ? midOnRoute.lon : (lon1 + lon2) / 2;
    const durationMinutes = routeData.durationMin || 30;
    const midDate = new Date(depDate.getTime() + (durationMinutes / 2) * 60000);
    const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);

    const [originRaw, destRaw, midRaw] = await Promise.all([
      fetchOpenMeteoForecastRaw(lat1, lon1),
      fetchOpenMeteoForecastRaw(lat2, lon2),
      fetchOpenMeteoForecastRaw(midLat, midLon),
    ]);
    const [originAq, destAq, midAq] = await Promise.all([
      fetchAirQuality(lat1, lon1),
      fetchAirQuality(lat2, lon2),
      fetchAirQuality(midLat, midLon),
    ]);
    const originMerged = mergeAirQualityIntoHourly(originRaw, originAq);
    const destMerged = mergeAirQualityIntoHourly(destRaw, destAq);
    const midMerged = mergeAirQualityIntoHourly(midRaw, midAq);
    const originF = getForecastAtTime(originMerged.hourly, depDate, originMerged.timezone);
    const midF = getForecastAtTime(midMerged.hourly, midDate, midMerged.timezone);
    const destF = getForecastAtTime(destMerged.hourly, arrDate, destMerged.timezone);

    const routeResult = buildResultFromRouteData(
      routeData,
      lat1,
      lon1,
      lat2,
      lon2,
      depDate,
      mode,
      originF,
      destF,
      midF,
      midLat,
      midLon,
      durationMinutes,
      arrDate
    );
    if (returnMerged) {
      return { routeResult, originMerged, destMerged, midMerged };
    }
    return routeResult;
  }

  const legs = routeData.legs || [];
  if (legs.length !== waypoints.length + 1) throw new Error('Ruta no válida');

  let acc = 0;
  const arrivalDates = [depDate];
  legs.forEach((leg) => {
    acc += leg.durationMin;
    arrivalDates.push(new Date(depDate.getTime() + acc * 60000));
  });

  const coordsList = [
    { lat: originCoords.lat, lon: originCoords.lon },
    ...waypoints.map((w) => ({ lat: w.lat, lon: w.lon })),
    { lat: destCoords.lat, lon: destCoords.lon },
  ];
  const rawList = await Promise.all(coordsList.map((c) => fetchOpenMeteoForecastRaw(c.lat, c.lon)));
  const aqList = await Promise.all(coordsList.map((c) => fetchAirQuality(c.lat, c.lon)));
  const mergedList = rawList.map((raw, i) => mergeAirQualityIntoHourly(raw, aqList[i]));
  const forecasts = arrivalDates.map((d, i) => getForecastAtTime(mergedList[i].hourly, d, mergedList[i].timezone));
  forecasts.forEach((f, i) => {
    if (f && coordsList[i]) f.coords = coordsList[i];
  });
  const segmentKeys = ['origin', ...waypoints.map((_, i) => 'wp' + i), 'dest'];
  return buildResultWithLegs(routeData, originCoords, destCoords, waypoints, depDate, mode, forecasts, segmentKeys);
}

/**
 * Detecta si el error es de red/timeout (para mostrar mensaje traducido apropiado).
 */
export function isNetworkOrTimeoutError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('Timeout') ||
    msg.includes('Failed to fetch') ||
    msg.includes('network') ||
    msg.includes('CORS') ||
    msg.includes('504')
  );
}
