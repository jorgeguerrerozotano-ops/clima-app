/**
 * geoUtils.js — Geocoding, búsqueda de ubicaciones y formateo de lugares.
 * Nominatim (OpenStreetMap), OpenRouteService (Pelias), formatos para UI.
 */

import i18n from '../i18n';

const NOMINATIM_SEARCH_BASE = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_BASE = 'https://nominatim.openstreetmap.org/reverse';

export const getNominatimHeaders = () => {
  const locale = i18n?.language || navigator?.language?.split('-')[0] || 'es';
  return {
    'User-Agent': 'MiClimaApp/1.0 (https://github.com/mi-clima-app)',
    Accept: 'application/json',
    'Accept-Language': locale,
  };
};

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

const ORS_GEOCODE_BASE = 'https://api.openrouteservice.org/geocode/autocomplete';

/**
 * Convierte un feature de Pelias/ORS (GeoJSON) al formato Nominatim para usar formatForList sin cambios.
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
 * Usa VITE_ORS_API_KEY. Devuelve array en formato Nominatim para que formatForList funcione igual.
 */
export const searchLocationORS = async (query, opts = {}) => {
  const apiKey = import.meta.env.VITE_ORS_API_KEY;
  if (!apiKey) throw new Error('VITE_ORS_API_KEY no configurada');
  const limit = opts.limit ?? 8;
  const url = `${ORS_GEOCODE_BASE}?text=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: apiKey }
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
    if (!zone) zone = a.city;
    if (!zone && data.name) zone = data.name;
    if (!zone) zone = i18n.t('location.placeholder');
    parts.push(zone);
    const city = a.city || a.town || a.municipality;
    const province = a.province || a.county;
    if (city && city !== zone) parts.push(city);
    else if (province && province !== zone && province !== city) parts.push(province);
    if (a.country) parts.push(a.country);
    return parts.join(', ');
  }
  return data.name || i18n.t('location.selected');
};

/**
 * Obtiene el nombre (y opcionalmente el país) de una ubicación a partir de coordenadas.
 * Usa Nominatim reverse geocoding + formatStandardLocation.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @returns {Promise<{ name: string, country?: string }>} name siempre; country si viene en address
 * @throws {Error} Si la petición falla o la respuesta no es válida
 */
export async function getLocationFromCoords(lat, lon) {
  const url = `${NOMINATIM_REVERSE_BASE}?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
  const res = await fetch(url, { headers: getNominatimHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Nominatim ${res.status}`);
  const name = formatStandardLocation(data);
  const country = data?.address?.country;
  return { name, country };
}

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
 */
export const formatForList = (item) => {
  const a = item.address || {};
  const road = a.road || a.pedestrian || a.street;
  const houseNumber = a.house_number || a.housenumber || '';
  const roadWithNumber = [road, houseNumber].filter(Boolean).join(' ').trim();

  let mainText = '';
  if (item.name && item.name.trim()) {
    const isPoi = !road || item.name.trim() !== roadWithNumber;
    if (isPoi) mainText = item.name.trim();
  }
  if (!mainText && roadWithNumber) mainText = roadWithNumber;
  if (!mainText) mainText = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || '';
  if (!mainText) mainText = a.city || a.town || a.municipality || a.village || '';

  let subText = getLocationContext(item);
  if (mainText && subText) {
    const parts = subText.split(',').map((p) => p.trim()).filter(Boolean);
    const filtered = parts.filter((p) => p !== mainText);
    subText = filtered.join(', ');
  }

  return { mainText: mainText || item.display_name || item.label || '', subText, original: item };
};
