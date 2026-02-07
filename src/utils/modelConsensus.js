/**
 * Model Consensus Service - Fetching Strategy
 * Resiliente, con alineación temporal y fallback por disponibilidad.
 * Compara ECMWF, GFS e ICON para medir confianza del pronóstico.
 *
 * @see https://open-meteo.com/en/docs
 */

/**
 * @typedef {'high' | 'low' | 'unavailable'} ConfidenceLevel
 *
 * @typedef {Object} ConsensusResult
 * @property {number} temperature - Temperatura consensuada (°C)
 * @property {number} source_count - Número de modelos usados (1-3)
 * @property {ConfidenceLevel} confidence_level - Nivel de confianza
 * @property {number} [delta] - Diferencia max-min entre modelos (solo si source_count >= 2)
 * @property {string} primary_source - Modelo prioritario usado como referencia
 * @property {Record<string, number>} [raw_by_model] - Valores crudos por modelo (debugging)
 */

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/** Modelos en orden de prioridad: ECMWF > GFS > ICON (Primary Source) */
const MODEL_PRIORITY = ['ecmwf_ifs025', 'ecmwf_ifs', 'gfs_seamless', 'icon_seamless'];

/** Umbral de delta para alta confianza (°C) */
const DELTA_HIGH_CONFIDENCE = 1.5;

/** Modelos soportados (nombres exactos de la API) */
export const MODELS = {
  ECMWF: 'ecmwf_ifs025',
  GFS: 'gfs_seamless',
  ICON: 'icon_seamless',
};

/**
 * Construye la URL unificada para los 3 modelos en una sola petición.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {Object} [options] - Opciones adicionales
 * @returns {string} URL completa
 */
export function buildConsensusUrl(lat, lon, options = {}) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'temperature_2m',
    models: `${MODELS.ECMWF},${MODELS.GFS},${MODELS.ICON}`,
    timezone: options.timezone ?? 'UTC',
    forecast_hours: String(options.forecastHours ?? 24),
  });
  return `${BASE_URL}?${params.toString()}`;
}

/**
 * Normalización y alineación temporal por timestamp UTC.
 * No asume que los arrays tienen el mismo índice o longitud.
 * Construye un mapa: timestamp (YYYY-MM-DDTHH) -> { modelName: value }.
 * Permite comparar "manzanas con manzanas" si la API devolviera estructuras heterogéneas.
 *
 * @param {Object} hourly - Objeto hourly de la API
 * @returns {Map<string, Record<string, number>>} Mapa timestamp -> { modelo: valor }
 */
function alignDataByTimestamp(hourly) {
  const aligned = new Map();
  const times = hourly.time;
  const tempKeys = Object.keys(hourly).filter(
    (k) => k.startsWith('temperature_2m_') && k !== 'temperature_2m'
  );

  if (!Array.isArray(times)) return aligned;

  for (const tempKey of tempKeys) {
    const modelName = tempKey.replace('temperature_2m_', '');
    const values = hourly[tempKey];
    if (!Array.isArray(values)) continue;

    for (let i = 0; i < Math.min(times.length, values.length); i++) {
      const ts = times[i];
      const val = values[i];
      if (ts == null || val == null || Number.isNaN(Number(val))) continue;

      const tsNorm = new Date(ts).toISOString().slice(0, 13);
      if (!aligned.has(tsNorm)) aligned.set(tsNorm, {});
      aligned.get(tsNorm)[modelName] = Number(val);
    }
  }

  return aligned;
}

/**
 * Obtiene el timestamp objetivo para la hora solicitada.
 * targetIndex 0 = primera hora disponible (actual/próxima).
 * @param {Map<string, Record<string, number>>} alignedMap
 * @param {number} targetIndex
 * @returns {string|null}
 */
function getTargetTimestamp(alignedMap, targetIndex = 0) {
  const sorted = [...alignedMap.keys()].sort();
  return sorted[targetIndex] ?? null;
}

/**
 * Obtiene valores alineados para un timestamp, ordenados por prioridad ECMWF > GFS > ICON.
 * Filtra null/NaN; devuelve array vacío si ningún modelo tiene dato.
 * @param {Map<string, Record<string, number>>} alignedMap
 * @param {string} targetTimestamp
 * @returns {{ model: string, value: number }[]}
 */
function getAlignedValues(alignedMap, targetTimestamp) {
  const row = alignedMap.get(targetTimestamp) ?? {};
  const ordered = [];

  for (const model of MODEL_PRIORITY) {
    if (model in row && row[model] != null && !Number.isNaN(row[model])) {
      ordered.push({ model, value: row[model] });
    }
  }

  if (ordered.length > 0) return ordered;

  const fallback = Object.entries(row)
    .filter(([, v]) => v != null && !Number.isNaN(v))
    .map(([m, v]) => ({ model: m, value: v }));
  return fallback;
}

/**
 * Calcula el nivel de confianza según delta (max - min).
 * Solo aplicable si hay >= 2 modelos; con 1 modelo retorna 'unavailable'.
 * @param {{ value: number }[]} ordered - Valores ordenados por prioridad
 * @returns {ConfidenceLevel}
 */
function computeConfidence(ordered) {
  if (ordered.length < 2) return 'unavailable';
  const nums = ordered.map((o) => o.value);
  const delta = Math.max(...nums) - Math.min(...nums);
  return delta < DELTA_HIGH_CONFIDENCE ? 'high' : 'low';
}

/**
 * Función principal: Fetching Strategy con resiliencia y prioridad.
 * Escenario ideal (3): media de 3, confianza calculada.
 * Escenario parcial (2): media de 2, confianza calculada.
 * Escenario crítico (1): dato crudo, confianza 'unavailable'.
 * Fallo total (0): lanza error controlado.
 *
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @param {Object} [options] - Opciones
 * @param {number} [options.hourIndex=0] - Índice de hora (0 = actual/próxima)
 * @param {boolean} [options.includeRaw=false] - Incluir raw_by_model
 * @returns {Promise<ConsensusResult>}
 */
export async function fetchModelConsensus(lat, lon, options = {}) {
  const hourIndex = options.hourIndex ?? 0;
  const url = buildConsensusUrl(lat, lon, options);

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) throw new Error(data?.reason ?? `Error ${res.status}`);
  if (data?.error) throw new Error(data.reason ?? 'Servicio no disponible');

  const hourly = data?.hourly;
  if (!hourly?.time?.length) throw new Error('Datos incompletos');

  const aligned = alignDataByTimestamp(hourly);
  const targetTs = getTargetTimestamp(aligned, hourIndex);

  if (!targetTs) {
    throw new Error('Fallo total: no hay datos alineados para la hora solicitada');
  }

  const ordered = getAlignedValues(aligned, targetTs);

  if (ordered.length === 0) {
    throw new Error('Fallo total: ningún modelo devolvió datos válidos');
  }

  const primary_source = ordered[0].model;
  const values = ordered.map((o) => o.value);
  const source_count = values.length;

  let temperature;
  if (source_count >= 2) {
    temperature = values.reduce((a, b) => a + b, 0) / source_count;
  } else {
    temperature = values[0];
  }

  const confidence_level = computeConfidence(ordered);
  const raw_by_model = Object.fromEntries(ordered.map((o) => [o.model, o.value]));

  const result = {
    temperature: Math.round(temperature * 10) / 10,
    source_count,
    confidence_level,
    primary_source,
  };

  if (source_count >= 2) {
    const delta = Math.max(...values) - Math.min(...values);
    result.delta = Math.round(delta * 100) / 100;
  }

  if (options.includeRaw) {
    result.raw_by_model = raw_by_model;
  }

  return result;
}
