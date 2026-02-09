/**
 * weatherParser.js — Procesamiento puro de datos Open-Meteo para la app.
 * Reduce complejidad ciclomática del hook useWeather: funciones puras y testeables.
 */

import i18n from '../i18n';
import {
  getIndexOfCurrentTime,
  interpolateHourlyValue,
  interpolatePrecipTransitionTime,
  formatTimeRoundingToQuarterHour,
} from './timeUtils';
import { sanitizeCode, getRainText, getPrecipTypeLabel, getMoonPhase } from './weatherUtils';

const PRECIP_THRESHOLD_MM = 0.15;
const WINDOW_HOURS = 8;

/**
 * Extrae datos "actuales" desde la respuesta Open-Meteo (hora actual o fallback).
 * @param {Object} data - Respuesta con hourly, current, timezone
 * @param {number} currentHourIndex - Índice de la hora actual en hourly
 * @returns {Object} { baseCode, baseTemp, baseFeelsLike, baseIsDay, currentPrecipMM, probForNow, currentSnowCM, currentSnowDepth }
 */
export function parseCurrentWeather(data, currentHourIndex) {
  const startIndex = currentHourIndex !== -1 ? currentHourIndex : 0;
  const h = data.hourly;
  const c = data.current;

  const currentPrecipMM = currentHourIndex !== -1 ? h.precipitation[currentHourIndex] : c.precipitation;
  const currentProb = currentHourIndex !== -1 ? h.precipitation_probability[currentHourIndex] : 0;
  const interpolatedProb = interpolateHourlyValue(
    h.precipitation_probability,
    h.time,
    new Date(),
    data.timezone
  );
  const probForNow = interpolatedProb != null ? Math.round(interpolatedProb) : currentProb;

  let baseCode = currentHourIndex !== -1 ? h.weather_code[currentHourIndex] : c.weather_code;
  baseCode = sanitizeCode(baseCode, currentPrecipMM, probForNow);

  const baseTemp = currentHourIndex !== -1 ? h.temperature_2m[currentHourIndex] : c.temperature_2m;
  const baseFeelsLike = currentHourIndex !== -1 ? h.apparent_temperature[currentHourIndex] : c.apparent_temperature;
  const baseIsDay = currentHourIndex !== -1 ? h.is_day[currentHourIndex] : c.is_day;
  const currentSnowCM = currentHourIndex !== -1 ? (h.snowfall?.[currentHourIndex] ?? 0) : (c.snowfall ?? 0);
  const currentSnowDepth = currentHourIndex !== -1 ? (h.snow_depth?.[currentHourIndex] ?? 0) : (c.snow_depth ?? 0);

  return {
    startIndex,
    baseCode,
    baseTemp,
    baseFeelsLike,
    baseIsDay,
    currentPrecipMM,
    probForNow,
    currentSnowCM,
    currentSnowDepth,
  };
}

/**
 * Genera el texto de "próxima lluvia" según estado actual y previsión futura.
 * @param {Object} params - futurePrecip, futureProb, futureTime, futureSnow, futureTemp, currentPrecipMM, currentSnowCM, baseTemp
 * @returns {string} Texto traducido para nextRainText
 */
export function getNextRainText(params) {
  const {
    futurePrecip,
    futureProb,
    futureTime,
    futureSnow,
    futureTemp,
    currentPrecipMM,
    currentSnowCM,
    baseTemp,
  } = params;

  const isRainingNow = currentPrecipMM >= 0.15;
  const isSnowingNow = currentSnowCM > 0;

  if (!isRainingNow && !isSnowingNow && baseTemp <= -5) {
    return i18n.t('weather.arctic');
  }
  if (isRainingNow || isSnowingNow) {
    const stopIndex = futurePrecip.findIndex((mm) => mm < 0.15);
    const typeText = isSnowingNow ? i18n.t('weather.snow') : i18n.t('activities.rain');
    if (stopIndex === -1) return `${typeText} ${i18n.t('weather.continues')}`;
    const stopDate = new Date(futureTime[stopIndex]);
    return `${i18n.t('weather.stopsAt')} ${stopDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}`;
  }

  const rainIndex = futurePrecip.findIndex((mm, idx) => mm >= 0.25 && futureProb[idx] >= 30);
  if (rainIndex === -1) return i18n.t('weather.noPrecip');

  const rainDate = new Date(futureTime[rainIndex]);
  const today = new Date();
  const isToday = rainDate.getDate() === today.getDate();
  const prefix = isToday ? i18n.t('weather.atTime') : i18n.t('weather.tomorrowAt');
  const isNextSnow = futureSnow[rainIndex] > 0;
  const intensityText = getRainText(
    futureProb[rainIndex],
    futurePrecip[rainIndex],
    isNextSnow,
    futureTemp[rainIndex]
  );
  return `${intensityText} ${prefix} ${rainDate.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Genera la alerta de precipitación inminente (próximas 8h).
 * @param {Object} params - windowPrecip, windowSnow, windowTime, currentSnowCM, currentPrecipMM, timezone
 * @returns {Object|null} { type: 'stop'|'start', hourLabel, relativeLabel?, isSnow, precipTypeLabel, isApprox }
 */
export function generatePrecipitationAlert(params) {
  const { windowPrecip, windowSnow, windowTime, currentSnowCM, currentPrecipMM, timezone } = params;
  const hasPrecip = (i) => (windowPrecip[i] >= PRECIP_THRESHOLD_MM || windowSnow[i] > 0);
  const precipitatingNow = hasPrecip(0);

  if (precipitatingNow) {
    const stopIdx = windowTime.findIndex((_, i) => i > 0 && !hasPrecip(i));
    if (stopIdx === -1) return null;
    const t0 = windowTime[stopIdx - 1];
    const t1 = windowTime[stopIdx];
    const p0 = windowPrecip[stopIdx - 1];
    const p1 = windowPrecip[stopIdx];
    const interpolated = interpolatePrecipTransitionTime(t0, t1, p0, p1, PRECIP_THRESHOLD_MM);
    const hourLabel = formatTimeRoundingToQuarterHour(interpolated, timezone);
    const isSnow = currentSnowCM > 0;
    const precipTypeLabel = getPrecipTypeLabel(currentPrecipMM, currentSnowCM);
    return { type: 'stop', hourLabel, relativeLabel: null, isSnow, precipTypeLabel, isApprox: true };
  }

  const startIdx = windowTime.findIndex((_, i) => hasPrecip(i));
  if (startIdx === -1) return null;

  let interpolated;
  if (startIdx > 0) {
    const t0 = windowTime[startIdx - 1];
    const t1 = windowTime[startIdx];
    const p0 = windowPrecip[startIdx - 1];
    const p1 = windowPrecip[startIdx];
    interpolated = interpolatePrecipTransitionTime(t0, t1, p0, p1, PRECIP_THRESHOLD_MM);
  } else {
    interpolated = new Date(windowTime[0]);
  }
  const hourLabel = formatTimeRoundingToQuarterHour(interpolated, timezone);
  const now = Date.now();
  const diffMin = Math.round((interpolated - now) / 60000);
  const relativeLabel =
    diffMin < 60
      ? i18n.t('weather.inMinutes', { count: Math.max(0, diffMin) })
      : i18n.t('weather.inHours', { count: Math.round(diffMin / 60) });
  const isSnow = windowSnow[startIdx] > 0;
  const precipTypeLabel = getPrecipTypeLabel(windowPrecip[startIdx], windowSnow[startIdx]);
  return { type: 'start', hourLabel, relativeLabel, isSnow, precipTypeLabel, isApprox: true };
}

/**
 * Formatea la previsión horaria (próximas 24h) para la UI.
 * @param {Object} params - futureTime, futureTemp, futureCodes, futureIsDay, futureProb, futurePrecip, futureSnow, futureSnowDepth
 * @returns {Array} Array de { time, temp, iconCode, isDay, prob, mm, snowCM, snowDepth }
 */
export function formatHourlyForecast(params) {
  const {
    futureTime,
    futureTemp,
    futureCodes,
    futureIsDay,
    futureProb,
    futurePrecip,
    futureSnow,
    futureSnowDepth,
  } = params;
  return futureTime.slice(0, 24).map((time, i) => ({
    time: new Date(time).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
    temp: Math.round(futureTemp[i]),
    iconCode: futureCodes[i],
    isDay: futureIsDay[i],
    prob: futureProb[i],
    mm: futurePrecip[i],
    snowCM: futureSnow[i],
    snowDepth: futureSnowDepth[i],
  }));
}

/**
 * Procesa la respuesta Open-Meteo completa y devuelve la estructura consumida por HomeView/App.
 * Función pura: mismo input → mismo output.
 * @param {Object} data - Respuesta de API (con hourly, daily, current, timezone)
 * @param {string} locationName - Nombre del lugar
 * @param {string} country - País o "GPS"
 * @param {number} lat
 * @param {number} lon
 * @returns {Object} { location, timezone, current, astro, daily, analysis, rawHourly }
 */
export function processWeatherData(data, locationName, country, lat, lon) {
  if (!data?.hourly?.time?.length || !data?.daily?.sunrise?.length) {
    throw new Error('Estructura de datos inválida');
  }

  const currentHourIndex = getIndexOfCurrentTime(data.hourly.time, data.timezone);
  const current = parseCurrentWeather(data, currentHourIndex);

  const h = data.hourly;
  const futureProb = h.precipitation_probability.slice(current.startIndex);
  const futureTime = h.time.slice(current.startIndex);
  const futureCloud = h.cloud_cover.slice(current.startIndex);
  const futureTemp = h.temperature_2m.slice(current.startIndex);
  let futureCodes = h.weather_code.slice(current.startIndex).map((c, i) =>
    sanitizeCode(c, h.precipitation.slice(current.startIndex)[i], futureProb[i])
  );
  const futureIsDay = h.is_day.slice(current.startIndex);
  const futurePrecip = h.precipitation.slice(current.startIndex);
  const futureSnow = (h.snowfall || []).slice(current.startIndex);
  const futureSnowDepth = (h.snow_depth || []).slice(current.startIndex);

  const nextRainText = getNextRainText({
    futurePrecip,
    futureProb,
    futureTime,
    futureSnow,
    futureTemp,
    currentPrecipMM: current.currentPrecipMM,
    currentSnowCM: current.currentSnowCM,
    baseTemp: current.baseTemp,
  });
  const isRainingNow = current.currentPrecipMM >= 0.15;

  const next12hClouds = futureCloud.slice(0, 12);
  const avgClouds = next12hClouds.length ? next12hClouds.reduce((a, b) => a + b, 0) / next12hClouds.length : 0;
  const laundrySafe = futurePrecip.slice(0, 12).every((mm) => mm < 0.2);

  const windowPrecip = futurePrecip.slice(0, WINDOW_HOURS);
  const windowSnow = futureSnow.slice(0, WINDOW_HOURS);
  const windowTime = futureTime.slice(0, WINDOW_HOURS);
  const precipitationAlert = generatePrecipitationAlert({
    windowPrecip,
    windowSnow,
    windowTime,
    currentSnowCM: current.currentSnowCM,
    currentPrecipMM: current.currentPrecipMM,
    timezone: data.timezone,
  });

  const hourlyForecast = formatHourlyForecast({
    futureTime,
    futureTemp,
    futureCodes,
    futureIsDay,
    futureProb,
    futurePrecip,
    futureSnow,
    futureSnowDepth,
  });

  const sunrise = new Date(data.daily.sunrise[0]).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const sunset = new Date(data.daily.sunset[0]).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const moonPhase = getMoonPhase(new Date());

  return {
    location: { name: locationName, country, lat, lon },
    timezone: data.timezone,
    current: {
      temp: Math.round(current.baseTemp),
      feelsLike: Math.round(current.baseFeelsLike),
      humidity: data.current.relative_humidity_2m,
      code: current.baseCode,
      isDay: current.baseIsDay,
      wind_speed: data.current.wind_speed_10m,
      cloud_cover: data.current.cloud_cover,
      precip: current.currentPrecipMM,
      snow: current.currentSnowCM,
      snowDepth: current.currentSnowDepth,
      precipProbability: current.probForNow,
    },
    astro: { sunrise, sunset, moonPhase },
    daily: data.daily,
    analysis: {
      nextRainText,
      isRainingNow,
      laundrySafe,
      avgClouds,
      hourlyForecast,
      precipitationAlert,
    },
    rawHourly: data.hourly,
  };
}
