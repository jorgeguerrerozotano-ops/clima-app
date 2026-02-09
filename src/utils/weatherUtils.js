/**
 * weatherUtils.js — Diccionario climático (WMO), sanitización de códigos, luna, precipitación, tendencias.
 */

import i18n from '../i18n';

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

export const sanitizeCode = (originalCode, precipMM, rainProb = 100) => {
  const probThreshold = (originalCode >= 80 && originalCode <= 99) ? 20 : 30;
  if (rainProb < probThreshold) {
    if (originalCode >= 51 && originalCode <= 67) return 3;
    if (originalCode >= 80 && originalCode <= 82) return 3;
  }
  if (precipMM < 0.15) {
    if (originalCode > 48) {
      if (originalCode >= 95) return originalCode;
      if ((originalCode >= 71 && originalCode <= 77) || (originalCode >= 85 && originalCode <= 86)) return originalCode;
      if (rainProb > 50) {
        if (originalCode >= 61 && originalCode <= 67) return 51;
        if (originalCode >= 80 && originalCode <= 82) return 51;
        return originalCode;
      }
      return 3;
    }
    return originalCode;
  }
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

export const getRainText = (prob, mm, isSnow = false, temp = null) => {
  const t = (key, opts) => i18n.t(key, opts);
  if (temp !== null && temp <= -5 && mm < 0.1) {
    if (temp <= -10) return t('rain.polarCold');
    return t('rain.arcticEnv');
  }
  const noun = isSnow ? t('weather.snow') : t('activities.rain');
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
