/**
 * weekUtils.js — Número de semana ISO (1–52), rango legible y fecha de inicio.
 * Usado por HistoryTab y WeekSelector para consistencia.
 */

/**
 * Devuelve el número de semana del año (1–52) según lógica ISO.
 * @param {Date} d
 * @returns {number}
 */
export function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/**
 * Devuelve la fecha de inicio (lunes) de la semana N del año.
 * @param {number} weekNo - 1–52
 * @param {number} year
 * @returns {Date}
 */
export function getWeekStartDate(weekNo, year) {
  return new Date(year, 0, 1 + (weekNo - 1) * 7);
}

/**
 * Devuelve un string de rango legible para la semana, ej. "14 oct - 20 oct" (es) o "Jun 3 - Jun 9" (en).
 * Usa el locale indicado para formatear los nombres de mes.
 * @param {number} weekNo - 1–52
 * @param {string} language - Código de idioma actual (ej. i18n.language); se normaliza a base (en, es).
 * @returns {string}
 */
export function getWeekRange(weekNo, language = 'es') {
  const lang = (language || 'es').split('-')[0];
  const curr = new Date();
  const year = curr.getFullYear();
  const requiredDate = new Date(year, 0, 1 + (weekNo - 1) * 7);
  const startMonth = requiredDate.toLocaleString(lang, { month: 'short' });
  const startDay = requiredDate.getDate();
  const endDate = new Date(requiredDate);
  endDate.setDate(endDate.getDate() + 6);
  const endMonth = endDate.toLocaleString(lang, { month: 'short' });
  const endDay = endDate.getDate();
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}
