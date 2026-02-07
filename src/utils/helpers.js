// src/utils/helpers.js

import i18n from '../i18n';

// --- NOMINATIM (OpenStreetMap): User-Agent obligatorio por política de uso ---
export const getNominatimHeaders = () => {
  const locale = i18n?.language || navigator?.language?.split('-')[0] || 'es';
  return {
    'User-Agent': 'MiClimaApp/1.0 (https://github.com/mi-clima-app)',
    Accept: 'application/json',
    'Accept-Language': locale,
  };
};

const NOMINATIM_SEARCH_BASE = 'https://nominatim.openstreetmap.org/search';

/**
 * Búsqueda de ubicaciones con Nominatim (OpenStreetMap).
 * @param {string} query - Texto de búsqueda
 * @param {{ limit?: number }} [opts] - Opciones (limit, por defecto 8)
 * @returns {Promise<Array<{ lat: string, lon: string, display_name: string, name?: string, address: object }>>}
 */
export const searchLocationNominatim = async (query, opts = {}) => {
  const limit = opts.limit ?? 8;
  const locale = getNominatimHeaders()['Accept-Language'] || 'es';
  const url = `${NOMINATIM_SEARCH_BASE}?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1&accept-language=${locale}`;
  const res = await fetch(url, { headers: getNominatimHeaders() });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

/** @deprecated Use getNominatimHeaders() for dynamic locale */
export const NOMINATIM_HEADERS = {
  'User-Agent': 'MiClimaApp/1.0 (https://github.com/mi-clima-app)',
  Accept: 'application/json',
};

// --- DICCIONARIO CLIMÁTICO OFICIAL ---
export const getWeatherInfo = (code) => {
    const t = (key) => i18n.t(key);
    if (code === 0) return { label: t('weather.clear'), color: 'text-yellow-400' };
    if (code >= 1 && code <= 3) return { label: t('weather.cloudy'), color: 'text-gray-300' };
    if (code >= 45 && code <= 48) return { label: t('weather.fog'), color: 'text-slate-400' };
    if (code >= 51 && code <= 57) return { label: t('weather.drizzle'), color: 'text-blue-300' };
    if (code === 61) return { label: t('weather.rainLight'), color: 'text-blue-300' };
    if (code === 63) return { label: t('weather.rainModerate'), color: 'text-blue-400' };
    if (code === 65) return { label: t('weather.rainHeavy'), color: 'text-blue-500' };
    if (code >= 66 && code <= 67) return { label: t('weather.rainFreezing'), color: 'text-cyan-200' };
    if (code >= 71 && code <= 77) return { label: t('weather.snow'), color: 'text-cyan-100' };
    if (code === 80) return { label: t('weather.showerLight'), color: 'text-blue-300' };
    if (code === 81) return { label: t('weather.showers'), color: 'text-blue-400' };
    if (code === 82) return { label: t('weather.showerHeavy'), color: 'text-blue-500' };
    if (code === 85 || code === 86) return { label: t('weather.snow'), color: 'text-cyan-100' };
    if (code >= 95) return { label: t('weather.storm'), color: 'text-purple-400' };
    return { label: t('weather.unknown'), color: 'text-gray-400' };
};

// --- FUNCIÓN DE SANITIZACIÓN (CORE DE LA SOLUCIÓN) ---
export const sanitizeCode = (originalCode, precipMM, rainProb = 100) => {
    // Umbral dinámico: tormentas/chubascos (80-99) menos probables pero más críticos → 20%; estratiforme (50-60) → 30%
    const probThreshold = (originalCode >= 80 && originalCode <= 99) ? 20 : 30;
    // 1. FILTRO ANTI-RUIDO (Probabilidad por debajo del umbral)
    if (rainProb < probThreshold) {
        if (originalCode >= 51 && originalCode <= 67) return 3;
        if (originalCode >= 80 && originalCode <= 82) return 3;
    }

    // 2. FILTRO DE VOLUMEN (trazas: precipMM < 0.15)
    // Si probability > 50%, no convertir a nublado: son "trazas" peligrosas (p. ej. conducción)
    if (precipMM < 0.15) {
        if (originalCode > 48) {
             if (originalCode >= 95) return originalCode;
             if ((originalCode >= 71 && originalCode <= 77) || (originalCode >= 85 && originalCode <= 86)) {
                return originalCode;
             }
             if (rainProb > 50) {
                // Mantener código de lluvia o degradar a llovizna ligera (51) si es intenso
                if (originalCode >= 61 && originalCode <= 67) return 51;
                if (originalCode >= 80 && originalCode <= 82) return 51;
                return originalCode;
             }
             return 3;
        }
        return originalCode;
    }

    // 3. DEGRADACIÓN DE INTENSIDAD
    if (precipMM < 1.5) {
        if (originalCode === 65) return 63; 
        if (originalCode === 82) return 81; 
        if (originalCode === 81) return 80; 
    }
    
    return originalCode;
};

export const getMoonPhase = (date) => {
    const t = (key) => i18n.t(key);
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    if (month < 3) { year--; month += 12; }
    ++month;
    let c = 365.25 * year;
    let e = 30.6 * month;
    let total = c + e + day - 694039.09; 
    total /= 29.5305882; 
    let phase = total - Math.floor(total); 
    if (phase < 0.05) return t('moon.new');
    if (phase < 0.20) return t('moon.waxingCrescent'); 
    if (phase < 0.30) return t('moon.firstQuarter'); 
    if (phase < 0.45) return t('moon.waxingGibbous'); 
    if (phase < 0.55) return t('moon.full');
    if (phase < 0.70) return t('moon.waningGibbous'); 
    if (phase < 0.80) return t('moon.lastQuarter'); 
    if (phase < 0.95) return t('moon.waningCrescent'); 
    return t('moon.new');
};

/**
 * Obtiene el índice de la ranura horaria actual en el array hourly.time.
 * Usa la zona horaria de la ubicación (no la del dispositivo) para determinar "ahora".
 * Compara fecha+hora completa (año, mes, día, hora), nunca solo la hora.
 *
 * @param {string[]} timeArray - Array de timestamps ISO (hourly.time)
 * @param {string} [timezone] - Zona horaria de la ubicación (ej. "Europe/Madrid")
 * @param {Date} [now] - Momento de referencia (default: new Date())
 * @returns {number} Índice encontrado o -1 si no hay coincidencia
 */
export const getIndexOfCurrentTime = (timeArray, timezone, now = new Date()) => {
    if (!timeArray?.length) return -1;
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const opts = { timeZone: tz };
    const year = parseInt(now.toLocaleString('en-CA', { ...opts, year: 'numeric' }), 10);
    const month = parseInt(now.toLocaleString('en-CA', { ...opts, month: '2-digit' }), 10);
    const day = parseInt(now.toLocaleString('en-CA', { ...opts, day: '2-digit' }), 10);
    const hour = parseInt(now.toLocaleString('en-CA', { ...opts, hour: '2-digit', hour12: false }), 10);
    const idx = timeArray.findIndex((t) => {
        const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
        if (!m) return false;
        return parseInt(m[1], 10) === year && parseInt(m[2], 10) === month &&
               parseInt(m[3], 10) === day && parseInt(m[4], 10) === hour;
    });
    return idx;
};

/**
 * Interpolación lineal (LERP) para valores horarios.
 * Calcula el valor intermedio entre la hora actual y la siguiente según el minuto actual.
 * Solo para magnitudes continuas (temp, feelsLike). NO usar para weather_code, precipitation, etc.
 *
 * @param {number[]} arr - Array de valores (temperature_2m, apparent_temperature, etc.)
 * @param {string[]} timeArray - Array de timestamps ISO (hourly.time)
 * @param {Date} [now] - Momento actual (default: new Date())
 * @param {string} [timezone] - Zona horaria de la ubicación (para coincidir con datos Open-Meteo)
 * @returns {number|null} Valor interpolado o null si no hay datos
 */
export const interpolateHourlyValue = (arr, timeArray, now = new Date(), timezone = undefined) => {
    if (!arr?.length || !timeArray?.length || arr.length !== timeArray.length) return null;
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const opts = { timeZone: tz };
    const year = parseInt(now.toLocaleString('en-CA', { ...opts, year: 'numeric' }), 10);
    const month = parseInt(now.toLocaleString('en-CA', { ...opts, month: '2-digit' }), 10);
    const day = parseInt(now.toLocaleString('en-CA', { ...opts, day: '2-digit' }), 10);
    const hour = parseInt(now.toLocaleString('en-CA', { ...opts, hour: '2-digit', hour12: false }), 10);
    const minute = parseInt(now.toLocaleString('en-CA', { ...opts, minute: '2-digit' }), 10);
    const idx = timeArray.findIndex((t) => {
        const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
        if (!m) return false;
        return parseInt(m[1], 10) === year && parseInt(m[2], 10) === month &&
               parseInt(m[3], 10) === day && parseInt(m[4], 10) === hour;
    });
    if (idx === -1) return null;
    const a = arr[idx];
    if (a == null || Number.isNaN(Number(a))) return null;
    const nextIdx = Math.min(idx + 1, arr.length - 1);
    const b = arr[nextIdx];
    if (b == null || Number.isNaN(Number(b))) return Number(a);
    const t = minute / 60;
    return Number(a) + (Number(b) - Number(a)) * t;
};

/**
 * Interpola el instante en que la precipitación cruza un umbral entre dos horas (lineal).
 * Para alerta de inicio/fin de lluvia: da un instante aproximado entre t0 y t1.
 * @param {string|Date} t0 - Timestamp inicio (hora con precip)
 * @param {string|Date} t1 - Timestamp fin (hora siguiente)
 * @param {number} value0 - Precip en t0 (mm)
 * @param {number} value1 - Precip en t1 (mm)
 * @param {number} threshold - Umbral (ej. 0.15)
 * @returns {Date} Instante interpolado
 */
export const interpolatePrecipTransitionTime = (t0, t1, value0, value1, threshold = 0.15) => {
    const ms0 = new Date(t0).getTime();
    const ms1 = new Date(t1).getTime();
    const denom = value1 - value0;
    let fraction = 0.5;
    if (denom !== 0) {
        fraction = (threshold - value0) / denom;
        if (fraction < 0) fraction = 0;
        if (fraction > 1) fraction = 1;
    }
    return new Date(ms0 + fraction * (ms1 - ms0));
};

/**
 * Redondea la hora de un Date a cuartos de hora (0, 15, 30, 45 min) en la zona horaria dada.
 * @param {Date} date - Instante
 * @param {string} timezone - Zona horaria (ej. Europe/Madrid)
 * @returns {string} "HH:mm" en cuartos de hora (ej. "18:30")
 */
export const formatTimeRoundingToQuarterHour = (date, timezone) => {
    const s = new Date(date).toLocaleString('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    let [h, m] = s.split(':').map(Number);
    let mRounded = Math.round(m / 15) * 15;
    if (mRounded === 60) {
        mRounded = 0;
        h = (h + 1) % 24;
    }
    return `${String(h).padStart(2, '0')}:${String(mRounded).padStart(2, '0')}`;
};

export const calculateClimateTrends = (chartData) => {
    if (!chartData || chartData.length === 0) return null;
    const currentYear = new Date().getFullYear();
    const cutoffYear = currentYear - 15; 
    let totalTemp = 0, totalRain = 0, recentTemp = 0, recentRain = 0, recentCount = 0, yearsWithRain = 0, sumMax = 0, sumMin = 0;

    chartData.forEach(d => {
        totalTemp += d.avgTemp; totalRain += d.totalRain; sumMax += d.meanMax; sumMin += d.meanMin;
        if (d.totalRain > 1.0) yearsWithRain++;
        if (d.year >= cutoffYear) { recentTemp += d.avgTemp; recentRain += d.totalRain; recentCount++; }
    });

    const historicalAvgTemp = totalTemp / chartData.length;
    const historicalAvgRain = totalRain / chartData.length;
    const recentAvgTemp = recentCount > 0 ? recentTemp / recentCount : 0;
    const recentAvgRain = recentCount > 0 ? recentRain / recentCount : 0;
    const probValue = (yearsWithRain / chartData.length) * 100;
    
    const t = (key) => i18n.t(key);
    let probText = t('probability.none');
    if (probValue > 0) probText = t('probability.low');
    if (probValue >= 30) probText = t('probability.medium');
    if (probValue >= 60) probText = t('probability.high');
    if (probValue >= 80) probText = t('probability.veryHigh');

    return {
        avgMaxGlobal: (sumMax / chartData.length).toFixed(1),
        avgMinGlobal: (sumMin / chartData.length).toFixed(1),
        tempDelta: (recentAvgTemp - historicalAvgTemp).toFixed(1),
        rainDelta: (recentAvgRain - historicalAvgRain).toFixed(1),
        rainProbValue: Math.round(probValue),
        rainProbText: probText
    };
};

/**
 * Obtiene ruta desde OSRM. Con waypoints opcionales devuelve legs (duración por tramo).
 * @param {number} lat1 - Origen lat
 * @param {number} lon1 - Origen lon
 * @param {number} lat2 - Destino lat
 * @param {number} lon2 - Destino lon
 * @param {string} mode - 'moto'|'car'|'bicycle'|'walk'
 * @param {{lat:number,lon:number}[]} [waypoints] - Puntos intermedios (opcional)
 * @returns {{ distanceKm: string, durationMin: number, legs?: { durationMin: number, distanceKm: number }[], routeGeometry?: [number,number][] }}
 */
const processOsrmRoute = (route, mode) => {
    const distKm = route.distance / 1000;
    const toLegDurationMin = (legDistM, legDurSec) => {
        if (mode === 'walk') return Math.round((legDistM / 1000 / 5) * 60);
        if (mode === 'bicycle') return Math.round((legDistM / 1000 / 20) * 60);
        return Math.round(legDurSec / 60);
    };
    let totalDurationMin; let legs;
    if (route.legs && route.legs.length > 0) {
        legs = route.legs.map(leg => {
            const legDistKm = leg.distance / 1000;
            const durationMin = toLegDurationMin(leg.distance, leg.duration);
            return { durationMin, distanceKm: legDistKm };
        });
        totalDurationMin = legs.reduce((sum, l) => sum + l.durationMin, 0);
    } else {
        if (mode === 'walk') totalDurationMin = Math.round((distKm / 5) * 60);
        else if (mode === 'bicycle') totalDurationMin = Math.round((distKm / 20) * 60);
        else totalDurationMin = Math.round(route.duration / 60);
    }
    const out = { distanceKm: distKm.toFixed(1), durationMin: totalDurationMin };
    if (legs) out.legs = legs;
    if (route.geometry?.coordinates?.length) {
        out.routeGeometry = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    }
    return out;
};

/**
 * Adapta la respuesta de OpenRouteService v2 al formato OSRM esperado por processOsrmRoute.
 * @param {Object} orsRoute - Ruta de ORS (con summary, geometry, segments)
 * @param {string} mode - Modo de transporte
 * @returns {Object} Ruta en formato OSRM compatible
 */
const adaptORSToOSRM = (orsRoute, mode) => {
    const summary = orsRoute.summary || {};
    const distance = summary.distance || 0; // metros
    const duration = summary.duration || 0; // segundos
    
    // Convertir geometry de ORS (GeoJSON LineString) al formato OSRM
    let geometry = null;
    if (orsRoute.geometry) {
        if (orsRoute.geometry.type === 'LineString' && orsRoute.geometry.coordinates) {
            // ORS usa [lon, lat], igual que OSRM en GeoJSON
            geometry = {
                type: 'LineString',
                coordinates: orsRoute.geometry.coordinates
            };
        } else if (Array.isArray(orsRoute.geometry)) {
            // Si viene como array directo
            geometry = {
                type: 'LineString',
                coordinates: orsRoute.geometry
            };
        }
    }
    
    // Procesar legs desde segments si están disponibles
    let legs = null;
    if (orsRoute.segments && Array.isArray(orsRoute.segments) && orsRoute.segments.length > 0) {
        legs = orsRoute.segments.map(segment => {
            const segSummary = segment.distance || 0;
            const segDuration = segment.duration || 0;
            return {
                distance: segSummary,
                duration: segDuration
            };
        });
    }
    
    return {
        distance,
        duration,
        geometry,
        legs
    };
};

const ORS_DIRECTIONS_BASE = 'https://api.openrouteservice.org/v2/directions';
const ORS_REQUEST_TIMEOUT_MS = 10000;

/**
 * Normaliza la respuesta de ORS a formato interno { routes }.
 * Acepta tanto GeoJSON FeatureCollection (endpoint /geojson) como el formato legacy { routes }.
 * @param {Object} data - Respuesta cruda de ORS (FeatureCollection o { routes })
 * @returns {{ routes: Array }}
 */
const normalizeORSResponse = (data) => {
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        const routes = data.features.map((feature) => ({
            geometry: feature.geometry || null,
            summary: feature.properties?.summary || {},
            segments: feature.properties?.segments || [],
            way_points: feature.properties?.way_points
        }));
        return { routes };
    }
    if (data.routes && Array.isArray(data.routes)) return { routes: data.routes };
    return { routes: [] };
};

/**
 * Una sola petición POST al endpoint GeoJSON de ORS (V2).
 * Body: coordinates, radiuses (-1 = snapping ilimitado por punto) y, si aplica, options.
 * @param {string} profile - Perfil ORS (driving-car, cycling-regular, foot-walking)
 * @param {number[][]} coordinates - [[lon, lat], ...]
 * @param {object} [options] - options.avoid_features (solo si hay opciones)
 * @returns {Promise<{routes: Array}>}
 */
const fetchORSDirectionsOnce = (profile, coordinates, options = null) => {
    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    if (!apiKey) return Promise.reject(new Error('VITE_ORS_API_KEY no configurada'));
    const cleanCoords = coordinates.map((pair) => [
        parseFloat(pair[0]),
        parseFloat(pair[1])
    ]);
    const body = {
        coordinates: cleanCoords,
        radiuses: cleanCoords.map(() => -1)
    };
    if (options) body.options = options;
    delete body.alternative_routes;
    if (import.meta.env.DEV) console.log('ORS Payload:', JSON.stringify(body));
    const url = `${ORS_DIRECTIONS_BASE}/${profile}/geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORS_REQUEST_TIMEOUT_MS);
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: apiKey },
        body: JSON.stringify(body),
        signal: controller.signal
    })
        .then((res) => {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`ORS API ${res.status}`);
            return res.json();
        })
        .then((data) => {
            const { routes } = normalizeORSResponse(data);
            if (!routes || routes.length === 0) throw new Error('No routes');
            return { routes };
        })
        .catch((err) => {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') throw new Error('Timeout al conectar con ORS');
            throw err;
        });
};

/**
 * Huella para deduplicar rutas: misma distancia y duración → misma ruta (o muy similar).
 * @param {{ distanceKm: string, durationMin: number }} r
 * @returns {string}
 */
const routeFingerprint = (r) => `${r.distanceKm}_${r.durationMin}`;

/**
 * Estrategia por diversidad: 3 peticiones paralelas (Rápida, Sin Peaje, Sin Autopistas).
 * Cada petición devuelve 1 ruta principal.
 * Etiquetas: Rápida, Sin Peaje, Sin Autopistas. Deduplicador por distanceKm + durationMin. Solo perfil driving (moto/coche).
 * @param {number} lat1 - Origen lat
 * @param {number} lon1 - Origen lon
 * @param {number} lat2 - Destino lat
 * @param {number} lon2 - Destino lon
 * @param {string} mode - 'moto'|'car'
 * @returns {Promise<{ routes: Array<{ routeLabel?: string }> }>}
 */
const fetchDiverseRoutes = async (lat1, lon1, lat2, lon2, mode = 'moto') => {
    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    if (!apiKey) throw new Error('VITE_ORS_API_KEY no configurada');
    const profile = 'driving-car';
    const coordinates = [[lon1, lat1], [lon2, lat2]];

    const fastPromise = fetchORSDirectionsOnce(profile, coordinates, null);
    const noTollPromise = fetchORSDirectionsOnce(profile, coordinates, { avoid_features: ['tollways'] });
    const noHighwaysPromise = fetchORSDirectionsOnce(profile, coordinates, { avoid_features: ['highways'] });

    const settled = await Promise.allSettled([fastPromise, noTollPromise, noHighwaysPromise]);

    const processed = [];

    const pushRouteIfValid = (route, routeLabel) => {
        if (!route) return;
        if (route.geometry?.coordinates?.length > 0) {
            const lastCoord = route.geometry.coordinates[route.geometry.coordinates.length - 1];
            const discrepancy = getDistanceFromLatLonInKm(lat2, lon2, lastCoord[1], lastCoord[0]);
            if (discrepancy > 50) return;
        }
        const adapted = adaptORSToOSRM(route, mode);
        const processedRoute = processOsrmRoute(adapted, mode);
        processedRoute.routeLabel = routeLabel;
        processed.push(processedRoute);
    };

    if (settled[0].status === 'fulfilled') {
        const data = settled[0].value;
        const routes = data.routes || [];
        routes.forEach((route) => pushRouteIfValid(route, 'Rápida'));
    }
    if (settled[1].status === 'fulfilled') {
        const route = settled[1].value.routes?.[0];
        pushRouteIfValid(route, 'Sin Peaje');
    }
    if (settled[2].status === 'fulfilled') {
        const route = settled[2].value.routes?.[0];
        pushRouteIfValid(route, 'Sin Autopistas');
    }

    if (import.meta.env.DEV) console.log('Rutas recibidas antes de filtrar:', processed.length);

    const seen = new Map();
    const unique = [];
    processed.forEach((r) => {
        const fp = routeFingerprint(r);
        if (seen.has(fp)) {
            const existing = unique[seen.get(fp)];
            if (!existing.routeLabel.includes(r.routeLabel)) {
                existing.routeLabel = existing.routeLabel + ' / ' + r.routeLabel;
            }
        } else {
            seen.set(fp, unique.length);
            unique.push(r);
        }
    });

    return { routes: unique };
};

/**
 * Obtiene rutas desde OpenRouteService API v2.
 * Sin waypoints y modo coche/moto: usa estrategia de diversidad (3 peticiones paralelas).
 * Con waypoints o modo a pie/bici: una sola petición.
 * @param {number} lat1 - Origen lat
 * @param {number} lon1 - Origen lon
 * @param {number} lat2 - Destino lat
 * @param {number} lon2 - Destino lon
 * @param {string} mode - 'moto'|'car'|'bicycle'|'walk'
 * @param {{lat:number,lon:number}[]} [waypoints] - Puntos intermedios (opcional)
 * @returns {Promise<{routes: Array}>} Siempre { routes: [...] }; cada ruta tiene distanceKm, durationMin, legs?, routeGeometry
 */
const fetchORSRoutes = async (lat1, lon1, lat2, lon2, mode = 'moto', waypoints = []) => {
    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    if (!apiKey) throw new Error('VITE_ORS_API_KEY no configurada');

    const profileMap = {
        'moto': 'driving-car',
        'car': 'driving-car',
        'bicycle': 'cycling-regular',
        'walk': 'foot-walking'
    };
    const profile = profileMap[mode] || 'driving-car';
    const coordinates = waypoints.length > 0
        ? [[lon1, lat1], ...waypoints.map(w => [w.lon, w.lat]), [lon2, lat2]]
        : [[lon1, lat1], [lon2, lat2]];

    // Diversidad semántica: 3 peticiones paralelas solo para coche/moto sin waypoints
    if (waypoints.length === 0 && (mode === 'moto' || mode === 'car')) {
        const { routes } = await fetchDiverseRoutes(lat1, lon1, lat2, lon2, mode);
        if (routes.length === 0) throw new Error('ORS: no se encontraron rutas (diversidad)');
        return { routes };
    }

    // Una sola petición (waypoints o bici/pie)
    const data = await fetchORSDirectionsOnce(profile, coordinates, null);
    if (data.routes[0].geometry && data.routes[0].geometry.coordinates?.length > 0) {
        const lastCoord = data.routes[0].geometry.coordinates[data.routes[0].geometry.coordinates.length - 1];
        const discrepancy = getDistanceFromLatLonInKm(lat2, lon2, lastCoord[1], lastCoord[0]);
        if (discrepancy > 50) throw new Error(`Ruta no encontrada (discrepancia: ${Math.round(discrepancy)}km)`);
    }
    const adapted = adaptORSToOSRM(data.routes[0], mode);
    const processed = processOsrmRoute(adapted, mode);

    return { routes: [processed] };
};

/**
 * Mapea mode de la app al perfil OSRM (router.project-osrm.org: car, bike, foot).
 */
const osrmProfileFromMode = (mode) => {
    const map = { car: 'driving', moto: 'driving', bicycle: 'bike', walk: 'foot' };
    return map[mode] || 'driving';
};

/**
 * Obtiene ruta desde OSRM (función original como fallback).
 * @param {number} lat1 - Origen lat
 * @param {number} lon1 - Origen lon
 * @param {number} lat2 - Destino lat
 * @param {number} lon2 - Destino lon
 * @param {string} mode - 'moto'|'car'|'bicycle'|'walk'
 * @param {{lat:number,lon:number}[]} [waypoints] - Puntos intermedios (opcional)
 * @returns {Promise<{routes: Array}>} Siempre { routes: [...] }
 */
const fetchOSRMRoute = async (lat1, lon1, lat2, lon2, mode = 'moto', waypoints = []) => {
    const profile = osrmProfileFromMode(mode);
    const coords = waypoints.length > 0
        ? [`${lon1},${lat1}`, ...waypoints.map(w => `${w.lon},${w.lat}`), `${lon2},${lat2}`].join(';')
        : `${lon1},${lat1};${lon2},${lat2}`;
    const alternativesParam = waypoints.length === 0 ? '&alternatives=3' : '';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson${alternativesParam}`;
    
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
    const t = (key, opts) => i18n.t(key, opts);
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) throw new Error(t('routes.routeNotFound'));
    const lastWp = data.waypoints[data.waypoints.length - 1].location;
    const discrepancy = getDistanceFromLatLonInKm(lat2, lon2, lastWp[1], lastWp[0]);
    if (discrepancy > 50) throw new Error(t('routes.noLandRoute', { km: Math.round(discrepancy) }));

    if (waypoints.length > 0) {
        return { routes: [processOsrmRoute(data.routes[0], mode)] };
    }
    return { routes: data.routes.map(r => processOsrmRoute(r, mode)) };
};

/**
 * Obtiene ruta con estrategia Primary + Fallback:
 * 1. Intenta obtener rutas desde OpenRouteService (con alternativas inteligentes)
 * 2. Si falla (429, 500, timeout, etc.), usa OSRM como fallback
 * 
 * @param {number} lat1 - Origen lat
 * @param {number} lon1 - Origen lon
 * @param {number} lat2 - Destino lat
 * @param {number} lon2 - Destino lon
 * @param {string} mode - 'moto'|'car'|'bicycle'|'walk'
 * @param {{lat:number,lon:number}[]} [waypoints] - Puntos intermedios (opcional)
 * @returns {Promise<{routes: Array}>} Siempre { routes: [...] }; cada ruta tiene distanceKm, durationMin, legs?, routeGeometry
 */
export const getRouteData = async (lat1, lon1, lat2, lon2, mode = 'moto', waypoints = []) => {
    try {
        const result = await fetchORSRoutes(lat1, lon1, lat2, lon2, mode, waypoints);
        if (result.routes && result.routes.length === 0) {
            throw new Error('ORS: sin rutas');
        }
        return result;
    } catch (error) {
        // Fallback: OSRM
        // Capturamos errores silenciosamente (429 Too Many Requests, 500, timeout, etc.)
        const isRetryableError = 
            error.message?.includes('429') || 
            error.message?.includes('500') || 
            error.message?.includes('503') ||
            error.message?.includes('timeout') ||
            error.message?.includes('network') ||
            error.name === 'TypeError' ||
            error.name === 'AbortError';
        
        if (isRetryableError || !import.meta.env.VITE_ORS_API_KEY) {
            console.warn('ORS no disponible, usando OSRM como fallback:', error.message || error);
        } else {
            // Si es un error de configuración o datos inválidos, también usar fallback
            console.warn('Error en ORS, usando OSRM como fallback:', error.message || error);
        }
        
        try {
            return await fetchOSRMRoute(lat1, lon1, lat2, lon2, mode, waypoints);
        } catch (fallbackError) {
            console.error("Error OSRM (fallback):", fallbackError);
            throw fallbackError;
        }
    }
};

// --- GEOCODING: OpenRouteService (Pelias) Autocomplete ---
const ORS_GEOCODE_BASE = 'https://api.openrouteservice.org/geocode/autocomplete';

/**
 * Convierte un feature de Pelias/ORS (GeoJSON) al formato Nominatim para usar formatForList sin cambios.
 * @param {Object} feature - GeoJSON Feature con geometry.coordinates y properties
 * @returns {{ lat: string, lon: string, display_name: string, name?: string, address: object, label?: string }}
 */
const mapORSFeatureToNominatim = (feature) => {
    const geom = feature.geometry || {};
    const coords = geom.coordinates || [];
    const lon = coords[0];
    const lat = coords[1];
    const p = feature.properties || {};
    const address = {
        road: p.street || undefined,
        pedestrian: p.street || undefined,
        house_number: p.housenumber || undefined,
        neighbourhood: p.neighbourhood || undefined,
        suburb: p.locality || undefined,
        city_district: p.locality || undefined,
        city: p.locality || undefined,
        town: p.locality || undefined,
        village: p.locality || undefined,
        county: p.county || undefined,
        province: p.region || undefined,
        region: p.region || undefined,
        country: p.country || undefined
    };
    return {
        lat: lat != null ? String(lat) : '',
        lon: lon != null ? String(lon) : '',
        display_name: p.label || [p.name, p.locality, p.country].filter(Boolean).join(', '),
        name: p.name || undefined,
        address,
        label: p.label
    };
};

/**
 * Búsqueda de ubicaciones con OpenRouteService (geocode/autocomplete).
 * Usa VITE_ORS_API_KEY. Devuelve array de objetos en formato Nominatim para que formatForList funcione igual.
 * @param {string} query - Texto de búsqueda
 * @param {{ limit?: number }} [opts] - Opciones (limit, por defecto 8)
 * @returns {Promise<Array<{ lat: string, lon: string, display_name: string, name?: string, address: object }>>}
 */
export const searchLocationORS = async (query, opts = {}) => {
    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    if (!apiKey) {
        throw new Error('VITE_ORS_API_KEY no configurada');
    }
    const limit = opts.limit ?? 8;
    const url = `${ORS_GEOCODE_BASE}?text=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: apiKey
        }
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`ORS Geocode ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const features = data.features || [];
    return features.map(mapORSFeatureToNominatim);
};

export const formatStandardLocation = (data) => {
    if (data.address) {
        const a = data.address;
        const parts = [];
        let zone = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || a.village || a.town || a.municipality;
        if (!zone) zone = a.city; if (!zone && data.name) zone = data.name; if (!zone) zone = i18n.t('location.placeholder');
        parts.push(zone);
        const city = a.city || a.town || a.municipality;
        const province = a.province || a.county;
        if (city && city !== zone) parts.push(city);
        else if (province && province !== zone && province !== city) parts.push(province);
        if (a.country) parts.push(a.country);
        return parts.join(", ");
    }
    return data.name || i18n.t('location.selected');
};

/**
 * Construye el contexto geográfico para el subtítulo: "Barrio, Ciudad, País".
 * Usa neighbourhood/suburb/district + city + country (sin duplicar con mainText).
 * @param {{ address?: object }} data - Objeto tipo Nominatim/ORS normalizado
 * @returns {string}
 */
const getLocationContext = (data) => {
    if (!data?.address) return '';
    const a = data.address;
    const neighbourhood = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district;
    const city = a.city || a.town || a.municipality || a.village;
    const country = a.country || '';
    const parts = [neighbourhood, city, country].filter(Boolean);
    return parts.join(', ');
};

/**
 * Formato jerárquico para resultados de búsqueda (Nominatim u ORS normalizado).
 * MainText: dato más específico (name POI > road+house_number > neighbourhood > city).
 * SubText: contexto "Barrio, Ciudad, País" sin repetir el valor de MainText.
 * @param {{ name?: string, address?: object, display_name?: string }} item
 * @returns {{ mainText: string, subText: string, original: object }}
 */
export const formatForList = (item) => {
    const a = item.address || {};
    const road = a.road || a.pedestrian || a.street;
    const houseNumber = a.house_number || a.housenumber || '';
    const roadWithNumber = [road, houseNumber].filter(Boolean).join(' ').trim();

    let mainText = '';
    // Prioridad: name (POI) > road + house_number > neighbourhood > city
    if (item.name && item.name.trim()) {
        const isPoi = !road || item.name.trim() !== roadWithNumber;
        if (isPoi) mainText = item.name.trim();
    }
    if (!mainText && roadWithNumber) mainText = roadWithNumber;
    if (!mainText) mainText = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || '';
    if (!mainText) mainText = a.city || a.town || a.municipality || a.village || '';

    let subText = getLocationContext(item);
    // Filtro de duplicados: no repetir en SubText lo que ya está en MainText
    if (mainText && subText) {
        const parts = subText.split(',').map((p) => p.trim()).filter(Boolean);
        const filtered = parts.filter((p) => p !== mainText);
        subText = filtered.join(', ');
    }

    return { mainText: mainText || item.display_name || item.label || '', subText, original: item };
};

export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1); const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
};
const deg2rad = (deg) => deg * (Math.PI/180);

/**
 * Punto sobre la polilínea a una fracción de la longitud total (0 = inicio, 1 = fin).
 * @param {[number,number][]} routeGeometry - Array [lat, lon] por punto
 * @param {number} fraction - Entre 0 y 1 (p. ej. 0.5 = mitad del camino)
 * @returns {{ lat: number, lon: number } | null}
 */
export const pointAlongRoute = (routeGeometry, fraction = 0.5) => {
    if (!routeGeometry || routeGeometry.length < 2 || fraction <= 0) {
        if (routeGeometry?.length === 1) return { lat: routeGeometry[0][0], lon: routeGeometry[0][1] };
        return null;
    }
    if (fraction >= 1) {
        const last = routeGeometry[routeGeometry.length - 1];
        return { lat: last[0], lon: last[1] };
    }
    let totalKm = 0;
    const segments = [];
    for (let i = 1; i < routeGeometry.length; i++) {
        const [latA, lonA] = routeGeometry[i - 1];
        const [latB, lonB] = routeGeometry[i];
        const d = getDistanceFromLatLonInKm(latA, lonA, latB, lonB);
        segments.push({ latA, lonA, latB, lonB, d });
        totalKm += d;
    }
    if (totalKm <= 0) {
        const [lat, lon] = routeGeometry[0];
        return { lat, lon };
    }
    const targetKm = fraction * totalKm;
    let acc = 0;
    for (const seg of segments) {
        if (acc + seg.d >= targetKm) {
            const t = seg.d > 0 ? (targetKm - acc) / seg.d : 0;
            return {
                lat: seg.latA + t * (seg.latB - seg.latA),
                lon: seg.lonA + t * (seg.lonB - seg.lonA)
            };
        }
        acc += seg.d;
    }
    const last = routeGeometry[routeGeometry.length - 1];
    return { lat: last[0], lon: last[1] };
};

/**
 * Punto más cercano sobre la polilínea a un punto dado (para snap a la ruta).
 * @param {{ lat: number, lon: number }} point - Punto { lat, lon }
 * @param {[number,number][]} polyline - Array [lat, lon] por punto
 * @returns {{ lat: number, lon: number } | null}
 */
export const closestPointOnPolyline = (point, polyline) => {
    if (!point || !polyline || polyline.length < 2) return point ? { lat: point.lat, lon: point.lon } : null;
    const result = closestPointOnPolylineWithFraction(point, polyline);
    return result ? { lat: result.lat, lon: result.lon } : null;
};

/**
 * Punto más cercano sobre la polilínea y su fracción (0 = inicio, 1 = fin).
 * @param {{ lat: number, lon: number }} point
 * @param {[number,number][]} polyline
 * @returns {{ lat: number, lon: number, fraction: number } | null}
 */
export const closestPointOnPolylineWithFraction = (point, polyline) => {
    if (!point || !polyline || polyline.length < 2) return point ? { lat: point.lat, lon: point.lon, fraction: 0 } : null;
    const { lat: px, lon: py } = point;
    let bestLat = polyline[0][0], bestLon = polyline[0][1], bestFraction = 0, bestD = Infinity;
    let totalKm = 0;
    const segs = [];
    for (let i = 1; i < polyline.length; i++) {
        const [latA, lonA] = polyline[i - 1];
        const [latB, lonB] = polyline[i];
        const d = getDistanceFromLatLonInKm(latA, lonA, latB, lonB);
        segs.push({ latA, lonA, latB, lonB, d });
        totalKm += d;
    }
    if (totalKm <= 0) return { lat: polyline[0][0], lon: polyline[0][1], fraction: 0 };
    let acc = 0;
    for (let i = 0; i < segs.length; i++) {
        const { latA, lonA, latB, lonB, d } = segs[i];
        const dx = (latB - latA) || 1e-10;
        const dy = (lonB - lonA) || 1e-10;
        let t = ((px - latA) * dx + (py - lonA) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
        const qLat = latA + t * (latB - latA);
        const qLon = lonA + t * (lonB - lonA);
        const distSq = (px - qLat) ** 2 + (py - qLon) ** 2;
        if (distSq < bestD) {
            bestD = distSq;
            bestLat = qLat;
            bestLon = qLon;
            bestFraction = (acc + t * d) / totalKm;
        }
        acc += d;
    }
    return { lat: bestLat, lon: bestLon, fraction: Math.max(0, Math.min(1, bestFraction)) };
};

/**
 * Fracción (0–1) del punto más cercano sobre la polilínea.
 */
export const fractionAlongPolyline = (point, polyline) => {
    const r = closestPointOnPolylineWithFraction(point, polyline);
    return r != null ? r.fraction : 0;
};

/**
 * Punto más cercano sobre la polilínea restringido al tramo [fracMin, fracMax].
 * El waypoint no puede quedar "más atrás" del anterior ni "más adelante" del siguiente.
 */
export const closestPointOnPolylineBetweenFractions = (point, polyline, fracMin, fracMax) => {
    if (!point || !polyline || polyline.length < 2) return point ? { lat: point.lat, lon: point.lon } : null;
    const r = closestPointOnPolylineWithFraction(point, polyline);
    if (!r) return null;
    const clamped = Math.max(fracMin ?? 0, Math.min(fracMax ?? 1, r.fraction));
    const pt = pointAlongRoute(polyline, clamped);
    return pt || { lat: r.lat, lon: r.lon };
};

/**
 * Punto sobre la ruta en una "zona libre" (lejos de puntos existentes).
 * @param {[number,number][]} routeGeometry - Polilínea [lat, lon][]
 * @param {{ lat: number, lon: number }[]} existingPoints - Origen, destino y paradas
 * @returns {{ lat: number, lon: number } | null}
 */
export const pointOnRouteInFreeZone = (routeGeometry, existingPoints = []) => {
    if (!routeGeometry || routeGeometry.length < 2) return null;
    const points = existingPoints.filter(p => p && typeof p.lat === 'number' && typeof p.lon === 'number');
    const fractions = [0.25, 0.33, 0.4, 0.5, 0.6, 0.67, 0.75];
    let best = null;
    let bestMinDist = -1;
    for (const frac of fractions) {
        const pt = pointAlongRoute(routeGeometry, frac);
        if (!pt) continue;
        let minDist = Infinity;
        for (const p of points) {
            const d = getDistanceFromLatLonInKm(pt.lat, pt.lon, p.lat, p.lon);
            if (d < minDist) minDist = d;
        }
        if (points.length === 0) minDist = 1;
        if (minDist > bestMinDist) {
            bestMinDist = minDist;
            best = pt;
        }
    }
    return best || pointAlongRoute(routeGeometry, 0.5);
};

export const getRainText = (prob, mm, isSnow = false, temp = null) => {
    const t = (key, opts) => i18n.t(key, opts);
    if (temp !== null && temp <= -5 && mm < 0.1) {
        if (temp <= -10) return t('rain.polarCold');
        return t('rain.arcticEnv');
    }
    const noun = isSnow ? t('weather.snow') : t('activities.rain');
    const nounLower = isSnow ? 'snow' : 'rain';

    if (mm < 0.1) return t('rain.noSignificant', { noun: noun.toLowerCase() });

    let text;
    if (isSnow) {
        if (mm < 0.5) text = t('rain.lightSnow');
        else if (mm < 2.0) text = t('rain.moderateSnow');
        else text = t('rain.heavySnow');
    } else {
        if (mm < 0.5) text = t('rain.drizzle');
        else if (mm < 2.0) text = t('rain.lightRain');
        else if (mm < 7.0) text = t('rain.moderateRain');
        else text = t('rain.heavyRain');
    }
    if (prob < 30) return `${t('rain.possible')} ${text.toLowerCase()}`;
    if (prob < 70) return `${t('rain.probable')} ${text.toLowerCase()}`;
    
    if (mm < 0.5 && !isSnow) return t('rain.persistentDrizzle');
    if (mm < 0.5 && isSnow) return t('rain.looseFlakes');

    return `${text} ${t('rain.assured')}`;
};

/**
 * Etiqueta de tipo/intensidad de precipitación según métricas (mismos umbrales que getRainText).
 * Para uso en alertas: solo el tipo (llovizna, lluvia ligera, nieve moderada, etc.).
 * @param {number} mm - Precipitación en mm
 * @param {number} snowCM - Nieve en cm (si > 0 se usa para bandas de nieve)
 */
export const getPrecipTypeLabel = (mm, snowCM = 0) => {
    const t = (key) => i18n.t(key);
    const isSnow = snowCM > 0;
    if (isSnow) {
        if (snowCM < 0.5) return t('rain.lightSnow');
        if (snowCM < 2.0) return t('rain.moderateSnow');
        return t('rain.heavySnow');
    }
    if (mm < 0.5) return t('rain.drizzle');
    if (mm < 2.0) return t('rain.lightRain');
    if (mm < 7.0) return t('rain.moderateRain');
    return t('rain.heavyRain');
};

// ==========================================
// --- SISTEMA DE CACHÉ HISTÓRICO OPTIMIZADO ---
// ==========================================

// 1. GENERADOR DE CLAVES DE 10KM (Rounding)
// Redondea a 1 decimal. Ej: 40.41 -> 40.4. 
// Esto agrupa ubicaciones en celdas de ~11.1km.
export const getClimateKey = (lat, lon) => {
    const latK = parseFloat(lat).toFixed(1);
    const lonK = parseFloat(lon).toFixed(1);
    return `hist_v3_${latK}_${lonK}`;
};

// 2. DATABASE UTILS (INDEXED DB) - Sin dependencias externas
const DB_NAME = 'ClimaRetroDB';
const STORE_NAME = 'history_store';
const DB_VERSION = 1;

const openHistoryDB = () => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject("IndexedDB not supported");
            return;
        }
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Error opening DB");
        request.onsuccess = (e) => resolve(e.target.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME); // Key-Value simple
            }
        };
    });
};

export const getHistoryFromDB = async (key) => {
    try {
        const db = await openHistoryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                // Verificamos caducidad (30 días para datos históricos)
                if (result && result.expiry > Date.now()) {
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null); // Fallback suave
        });
    } catch (e) {
        console.warn("DB Read Error:", e);
        return null;
    }
};

export const saveHistoryToDB = async (key, data) => {
    try {
        const db = await openHistoryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            // Guardamos con caducidad de 30 días
            const item = { 
                data: data, 
                expiry: Date.now() + (1000 * 60 * 60 * 24 * 30) 
            };
            store.put(item, key);
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject("DB Write Error");
        });
    } catch (e) {
        console.warn("DB Write Error:", e);
    }
};

// MANTENEMOS COMPATIBILIDAD (Para caché ligera localStorage)
export const getCachedData = (key) => {
    try {
        const item = localStorage.getItem('climaretro_data_' + key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() > parsed.expiry) { localStorage.removeItem('climaretro_data_' + key); return null; }
        return parsed.data;
    } catch (e) { return null; }
};

export const setCachedData = (key, data) => {
    try {
        const item = { data: data, expiry: Date.now() + (1000 * 60 * 60 * 24) };
        localStorage.setItem('climaretro_data_' + key, JSON.stringify(item));
    } catch (e) { console.warn("LocalStorage full"); }
};