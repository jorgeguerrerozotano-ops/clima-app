/**
 * routeUtils.js — Rutas (ORS/OSRM), geometría de polilíneas, distancia y puntos sobre ruta.
 */

import i18n from '../i18n';

/** URL del proxy de direcciones ORS (la API Key se inyecta en el servidor). */
const ORS_PROXY_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ORS_PROXY_URL) || '/api/ors-directions';
const ORS_REQUEST_TIMEOUT_MS = 10000;
const OSRM_REQUEST_TIMEOUT_MS = 15000;

export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg) => deg * (Math.PI / 180);

/**
 * Obtiene ruta desde OSRM. Con waypoints opcionales devuelve legs (duración por tramo).
 */
const processOsrmRoute = (route, mode) => {
  const distKm = route.distance / 1000;
  const toLegDurationMin = (legDistM, legDurSec) => {
    if (mode === 'walk') return Math.round((legDistM / 1000 / 5) * 60);
    if (mode === 'bicycle') return Math.round((legDistM / 1000 / 20) * 60);
    return Math.round(legDurSec / 60);
  };
  let totalDurationMin;
  let legs;
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
 */
const adaptORSToOSRM = (orsRoute, mode) => {
  const summary = orsRoute.summary || {};
  const distance = summary.distance || 0;
  const duration = summary.duration || 0;

  let geometry = null;
  if (orsRoute.geometry) {
    if (orsRoute.geometry.type === 'LineString' && orsRoute.geometry.coordinates) {
      geometry = {
        type: 'LineString',
        coordinates: orsRoute.geometry.coordinates
      };
    } else if (Array.isArray(orsRoute.geometry)) {
      geometry = {
        type: 'LineString',
        coordinates: orsRoute.geometry
      };
    }
  }

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

/**
 * Normaliza la respuesta de ORS a formato interno { routes }.
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

const fetchORSDirectionsOnce = (profile, coordinates, options = null) => {
  const cleanCoords = coordinates.map((pair) => [
    parseFloat(pair[0]),
    parseFloat(pair[1])
  ]);
  if (import.meta.env.DEV) console.log('ORS Proxy Payload:', JSON.stringify({ profile, coordinates: cleanCoords }));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ORS_REQUEST_TIMEOUT_MS);
  return fetch(ORS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, coordinates: cleanCoords, options: options || undefined }),
    signal: controller.signal
  })
    .then((res) => {
      clearTimeout(timeoutId);
      if (!res.ok) {
        return res.json().then((data) => {
          throw new Error(data?.error || `ORS API ${res.status}`);
        }).catch((e) => {
          if (e.message && e.message.startsWith('ORS')) throw e;
          throw new Error(`ORS API ${res.status}`);
        });
      }
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

const fetchORSRoutes = async (lat1, lon1, lat2, lon2, mode = 'moto', waypoints = [], requestOptions = {}) => {
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

  const orsOptions = requestOptions?.avoidFerries ? { avoid_features: ['ferries'] } : null;
  const data = await fetchORSDirectionsOnce(profile, coordinates, orsOptions);
  if (data.routes[0].geometry && data.routes[0].geometry.coordinates?.length > 0) {
    const lastCoord = data.routes[0].geometry.coordinates[data.routes[0].geometry.coordinates.length - 1];
    const discrepancy = getDistanceFromLatLonInKm(lat2, lon2, lastCoord[1], lastCoord[0]);
    if (discrepancy > 50) throw new Error(`Ruta no encontrada (discrepancia: ${Math.round(discrepancy)}km)`);
  }
  const adapted = adaptORSToOSRM(data.routes[0], mode);
  const processed = processOsrmRoute(adapted, mode);

  return { routes: [processed] };
};

const osrmProfileFromMode = (mode) => {
  const map = { car: 'driving', moto: 'driving', bicycle: 'bike', walk: 'foot' };
  return map[mode] || 'driving';
};

const fetchOSRMRoute = async (lat1, lon1, lat2, lon2, mode = 'moto', waypoints = []) => {
  const profile = osrmProfileFromMode(mode);
  const coords = waypoints.length > 0
    ? [`${lon1},${lat1}`, ...waypoints.map(w => `${w.lon},${w.lat}`), `${lon2},${lat2}`].join(';')
    : `${lon1},${lat1};${lon2},${lat2}`;
  const alternativesParam = waypoints.length === 0 ? '&alternatives=3' : '';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson${alternativesParam}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OSRM_REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Timeout al conectar con OSRM');
    throw err;
  }
  clearTimeout(timeoutId);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
  const t = (key, opts) => i18n.t(key, opts);
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) throw new Error(t('routes.routeNotFound'));
  const lastWp = data.waypoints[data.waypoints.length - 1].location;
  const discrepancy = getDistanceFromLatLonInKm(lat2, lon2, lastWp[1], lastWp[0]);
  if (discrepancy > 50) throw new Error(t('routes.noLandRoute', { km: Math.round(discrepancy) }));

  return { routes: [processOsrmRoute(data.routes[0], mode)] };
};

/**
 * Obtiene ruta con estrategia según modo y requestOptions:
 * - avoidFerries: true → ORS primero con avoid_features ferries (rutas alternativas sin cruzar mar).
 * - walk/bicycle (sin avoidFerries): OSRM primero; si falla → ORS.
 * - car/moto: ORS primero; si falla → OSRM.
 */
export const getRouteData = async (lat1, lon1, lat2, lon2, mode = 'moto', waypoints = [], requestOptions = {}) => {
  const profileOSRM = osrmProfileFromMode(mode);
  const tryOSRMFirst = !requestOptions?.avoidFerries && (mode === 'walk' || mode === 'bicycle');

  const tryORS = async () => {
    const result = await fetchORSRoutes(lat1, lon1, lat2, lon2, mode, waypoints, requestOptions);
    if (result.routes && result.routes.length === 0) throw new Error('ORS: sin rutas');
    return result;
  };
  const tryOSRM = () => fetchOSRMRoute(lat1, lon1, lat2, lon2, mode, waypoints);

  if (requestOptions?.avoidFerries) {
    try {
      return await tryORS();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('ORS con avoid ferries no disponible:', error.message || error);
      throw error;
    }
  }

  if (tryOSRMFirst) {
    try {
      return await tryOSRM();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`OSRM (${profileOSRM}) no disponible para ${mode}, intentando ORS:`, error.message || error);
      }
      try {
        return await tryORS();
      } catch (orsError) {
        console.error(`ORS tampoco disponible para ${mode}:`, orsError.message || orsError);
        throw orsError;
      }
    }
  }

  try {
    return await tryORS();
  } catch (error) {
    const isRetryableError =
      error.message?.includes('429') ||
      error.message?.includes('500') ||
      error.message?.includes('503') ||
      error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('network') ||
      error.name === 'TypeError' ||
      error.name === 'AbortError';

    if (isRetryableError || !import.meta.env.VITE_ORS_API_KEY) {
      console.warn(`ORS no disponible (mode=${mode}), usando OSRM (${profileOSRM}):`, error.message || error);
    } else {
      console.warn(`Error en ORS (mode=${mode}), usando OSRM (${profileOSRM}):`, error.message || error);
    }
    try {
      return await tryOSRM();
    } catch (fallbackError) {
      console.error(`Error OSRM (fallback, mode=${mode}):`, fallbackError);
      throw fallbackError;
    }
  }
};

/**
 * Punto sobre la polilínea a una fracción de la longitud total (0 = inicio, 1 = fin).
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
 * Vector tangente unitario (en grados) en un punto de la polilínea dado por la fracción.
 */
export const getTangentAtFraction = (routeGeometry, fraction) => {
  if (!routeGeometry || routeGeometry.length < 2) return null;
  let totalKm = 0;
  const segments = [];
  for (let i = 1; i < routeGeometry.length; i++) {
    const [latA, lonA] = routeGeometry[i - 1];
    const [latB, lonB] = routeGeometry[i];
    const d = getDistanceFromLatLonInKm(latA, lonA, latB, lonB);
    segments.push({ latA, lonA, latB, lonB, d });
    totalKm += d;
  }
  if (totalKm <= 0) return null;
  const targetKm = Math.max(0, Math.min(1, fraction)) * totalKm;
  let acc = 0;
  for (const seg of segments) {
    if (acc + seg.d >= targetKm) {
      const dlat = seg.latB - seg.latA;
      const dlon = seg.lonB - seg.lonA;
      const norm = Math.sqrt(dlat * dlat + dlon * dlon) || 1e-10;
      return { lat: dlat / norm, lon: dlon / norm };
    }
    acc += seg.d;
  }
  const last = segments[segments.length - 1];
  const dlat = last.latB - last.latA;
  const dlon = last.lonB - last.lonA;
  const norm = Math.sqrt(dlat * dlat + dlon * dlon) || 1e-10;
  return { lat: dlat / norm, lon: dlon / norm };
};

/**
 * Punto pivote a R km de P en la dirección perpendicular a la tangente.
 */
export const pivotPointFromTangent = (P, tangentUnit, distanceKm, sign = 1) => {
  const perpLat = -sign * tangentUnit.lon;
  const perpLon = sign * tangentUnit.lat;
  const latRad = (P.lat * Math.PI) / 180;
  const lenKm = Math.sqrt(Math.pow(111 * perpLat, 2) + Math.pow(111 * Math.cos(latRad) * perpLon, 2)) || 1e-10;
  return {
    lat: P.lat + (distanceKm * perpLat) / lenKm,
    lon: P.lon + (distanceKm * perpLon) / lenKm
  };
};

/**
 * Punto más cercano sobre la polilínea a un punto dado (para snap a la ruta).
 */
export const closestPointOnPolyline = (point, polyline) => {
  if (!point || !polyline || polyline.length < 2) return point ? { lat: point.lat, lon: point.lon } : null;
  const result = closestPointOnPolylineWithFraction(point, polyline);
  return result ? { lat: result.lat, lon: result.lon } : null;
};

/**
 * Punto más cercano sobre la polilínea y su fracción (0 = inicio, 1 = fin).
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
