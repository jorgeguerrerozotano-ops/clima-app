/**
 * timeUtils.js — Índice horario actual, interpolación de valores horarios, formato de hora.
 */

/**
 * Obtiene el índice de la ranura horaria actual en el array hourly.time.
 * Usa la zona horaria de la ubicación para determinar "ahora".
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
 * Interpola el instante en que la precipitación cruza un umbral entre dos horas.
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

/**
 * Genera un array de días para selectores de fecha (rutas, actividades).
 * Centraliza la lógica de "hoy, mañana, resto de días" usada en RouteView y ActivitiesTab.
 * @param {(key: string) => string} t - Función de traducción (i18n t)
 * @param {string} language - Código de idioma (ej. i18n.language)
 * @param {number} count - Número de días a generar (por defecto 7)
 * @returns {Array<{ value: string, label: string }>} value = YYYY-MM-DD, label = Hoy / Mañana / "Lun 10"
 */
export function getWeekDaysForSelector(t, language, count = 7) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    let label = i === 0 ? t('common.today') : i === 1 ? t('common.tomorrow') : date.toLocaleDateString(language, { weekday: 'short', day: 'numeric' });
    days.push({
      value: date.toISOString().split('T')[0],
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }
  return days;
}
