/**
 * weatherApi.js — Servicio unificado para Open-Meteo (forecast + calidad del aire).
 * Usado por useWeather (pantalla principal) y useRouteWeather (análisis de rutas).
 * Una sola fuente de verdad para fetch y merge de datos climáticos.
 */

const OPEN_METEO_FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const DEFAULT_FETCH_TIMEOUT_MS = 15000;

/**
 * Petición a Open-Meteo Forecast (variante completa: current + daily + hourly).
 * Usada por useWeather para la pantalla principal.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {Object} [options] - { elevation?: number, timeoutMs?: number }
 * @returns {Promise<Object>} Respuesta raw de la API (current, daily, hourly, timezone)
 */
export async function fetchOpenMeteoForecast(lat, lon, options = {}) {
    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth,cloud_cover',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
        hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,is_day,cloud_cover,wind_speed_10m,precipitation,snowfall,snow_depth,relative_humidity_2m',
        timezone: 'auto',
    });
    if (typeof options.elevation === 'number') {
        params.set('elevation', String(Math.round(options.elevation)));
    }
    const url = `${OPEN_METEO_FORECAST_BASE}?${params.toString()}`;
    const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.reason || `Error ${res.status}`);
        if (data?.error) throw new Error(data.reason || 'Servicio no disponible');
        if (!data?.hourly?.time || !data?.daily || !data?.current) throw new Error('Datos incompletos');
        return data;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') throw new Error('Timeout al obtener el tiempo');
        throw err;
    }
}

/**
 * Petición a Open-Meteo Forecast (variante reducida: current + hourly para rutas).
 * Incluye timeout y reintentos. Usada por useRouteWeather.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {Object} [options] - { timeoutMs?: number, retries?: number }
 * @returns {Promise<Object>} Respuesta raw (current, hourly, timezone)
 */
export async function fetchOpenMeteoForecastRaw(lat, lon, options = {}) {
    const url = `${OPEN_METEO_FORECAST_BASE}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth,relative_humidity_2m&timezone=auto`;
    const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const retries = options.retries ?? 1;

    const attempt = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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
}

/**
 * API de calidad del aire (Open-Meteo). Si falla, no bloquea; devuelve null.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @returns {Promise<Object|null>} Datos hourly.us_aqi por timestamp o null
 */
export async function fetchAirQuality(lat, lon) {
    try {
        const res = await fetch(`${AIR_QUALITY_BASE}?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto`);
        const aq = await res.json();
        if (!res.ok || aq?.error || !aq?.hourly?.time?.length) return null;
        return aq;
    } catch {
        return null;
    }
}

/**
 * Combina hourly.us_aqi del API de calidad del aire con los datos de forecast por timestamp.
 * Si aqData es null o no tiene us_aqi, devuelve data sin modificar.
 * @param {Object} data - Respuesta de Open-Meteo Forecast (con hourly.time)
 * @param {Object|null} aqData - Respuesta de fetchAirQuality (hourly.time, hourly.us_aqi)
 * @returns {Object} data con hourly.us_aqi añadido/alineado por timestamp
 */
export function mergeAirQualityIntoHourly(data, aqData) {
    if (!aqData?.hourly?.us_aqi || !data?.hourly?.time?.length) return data;
    const aqByTime = new Map();
    (aqData.hourly.time || []).forEach((t, i) => {
        aqByTime.set(t, aqData.hourly.us_aqi[i]);
    });
    const us_aqi = data.hourly.time.map((t) => aqByTime.get(t) ?? null);
    return { ...data, hourly: { ...data.hourly, us_aqi } };
}
