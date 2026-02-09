// src/utils/helpers.js — Barrel: re-exporta desde módulos temáticos para compatibilidad hacia atrás.
// El código real vive en: geoUtils, weatherUtils, timeUtils, routeUtils, storageUtils.

// Geocoding y formateo de ubicación
export {
  getNominatimHeaders,
  searchLocationNominatim,
  searchLocationORS,
  formatStandardLocation,
  formatForList,
  getLocationFromCoords,
  resolveLocationFromCoords,
  getCurrentPositionWithName,
} from './geoUtils';

// Clima: códigos WMO, luna, precipitación, tendencias
export {
  getWeatherInfo,
  sanitizeCode,
  getMoonPhase,
  getRainText,
  getPrecipTypeLabel,
  getSafeWeatherData,
  calculateClimateTrends
} from './weatherUtils';

// Tiempo: índice horario, interpolación, formato
export {
  getIndexOfCurrentTime,
  interpolateHourlyValue,
  interpolatePrecipTransitionTime,
  formatTimeRoundingToQuarterHour,
  getWeekDaysForSelector,
} from './timeUtils';

// Rutas (ORS/OSRM) y geometría de polilíneas
export {
  getRouteData,
  getDistanceFromLatLonInKm,
  pointAlongRoute,
  getTangentAtFraction,
  pivotPointFromTangent,
  closestPointOnPolyline,
  closestPointOnPolylineWithFraction,
  fractionAlongPolyline,
  closestPointOnPolylineBetweenFractions,
  pointOnRouteInFreeZone
} from './routeUtils';

// Caché histórico (IndexedDB) y localStorage
export {
  getClimateKey,
  getHistoryFromDB,
  saveHistoryToDB,
  getCachedData,
  setCachedData
} from './storageUtils';

// API Open-Meteo (forecast + calidad del aire) — servicio unificado para useWeather y useRouteWeather
export {
  fetchOpenMeteoForecast,
  fetchOpenMeteoForecastRaw,
  fetchAirQuality,
  mergeAirQualityIntoHourly
} from './weatherApi';
