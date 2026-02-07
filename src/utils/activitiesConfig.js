// src/utils/activitiesConfig.js
// V9 - FACTORES DINÁMICOS Y PRIORIZACIÓN POR GRAVEDAD

import i18n from '../i18n';
import { getRainText, sanitizeCode } from './helpers';
import { prioritizeFactors, mapFactorsToLegacy } from './riskUtils';

/** Crea un factor estandarizado: type, value, status, label, description, score */
const createFactor = (type, value, status, label, description = '', score = 0) => ({
    type, value, status, label, description, score
});

// 2. Iconos de actividad (Lucide vía iconMap)
import { ACTIVITY_ICONS, getActivityIcon } from './iconMap';

export const AVAILABLE_ICONS = ACTIVITY_ICONS;
export const getIconComponent = (iconName) => getActivityIcon(iconName);

// Estándares de Recomendación Climática (umbrales de decisión)
const SAFETY_LIMITS = {
    HUMAN_MIN_TEMP: -10,
    HUMAN_MAX_TEMP: 32,
    MOTO_MIN_TEMP: 2,
    MOTO_MAX_WIND: 45,
    MOTO_WIND_WARNING: 30,
    LAUNDRY_MAX_WIND: 40,
    LAUNDRY_STAGNANT_WIND: 5,
    RUNNING_WIND_WARNING: 30,
    RUNNING_WIND_CRITICAL: 50,
    RUNNING_HEAT_WARNING: 27,
    RUNNING_HEAT_CRITICAL: 32,
    RUNNING_COLD_WARNING: 0,
    RUNNING_COLD_CRITICAL: -10,
    RUNNING_RAIN_WARNING_MM: 0.5,
    MOTO_RAIN_WARNING_MAX: 0.5,
    MOTO_RAIN_ACTIVE_MM: 0.5,
    MOTO_RAIN_CRITICAL_MM: 4.0,
    MOTO_RAIN_PROB_WARNING: 15,
    MOTO_HEAT_WARNING: 30,
    MOTO_HEAT_CRITICAL: 35,
    MOTO_TEMP_WARNING: 5,
    MOTO_VIS_WARNING_M: 1000,
    MOTO_VIS_CRITICAL_M: 200,
    LAUNDRY_HUMIDITY_WARNING: 70,
    LAUNDRY_HUMIDITY_CRITICAL: 85,
    LAUNDRY_TEMP_WARNING: 10,
    LAUNDRY_TEMP_CRITICAL: 5,
    LAUNDRY_RAIN_PROB_WARNING: 20,
    LAUNDRY_RAIN_PROB_CRITICAL: 50,
    LAUNDRY_RAIN_MM_SAFE: 0.15,
    LAUNDRY_RAIN_MM_DRIZZLE: 0.5,
    AQI_CRITICAL_RUNNING: 150,
    UV_EXTREME: 11,
    UV_HIGH: 8,
    UV_MODERATE: 6,
    VISIBILITY_POOR_M: 1000,
    VISIBILITY_CRITICAL_M: 200,
};
// WMO: Granizo/Lluvia helada — 66,67 = freezing rain; 90 = thunderstorm with hail
const WMO_HAIL_OR_ICE_RAIN = [66, 67, 90];

const t = (k, o) => i18n.t(k, o);

export const PREDEFINED_ACTIVITIES = [
  { id: 'moto', labelKey: 'activities.moto', durationLabelKey: 'activities.duration30', icon: 'moto', duration: 30, rules: { mode: 'moto', rainPreference: 'strict' } },
  { id: 'running', labelKey: 'activities.running', durationLabelKey: 'activities.duration45', icon: 'run', duration: 45, rules: { mode: 'standard', rainMax: 0.5, rainPreference: 'flexible', tempMin: 6, tempMax: 25, windMax: 25 } },
  { id: 'laundry', labelKey: 'activities.laundry', durationLabelKey: 'activities.duration12h', icon: 'laundry', duration: 720, rules: { mode: 'laundry', rainPreference: 'strict' } }
];

export const getActivityDisplayLabel = (act) => act.labelKey ? t(act.labelKey) : act.label;
export const getActivityDurationLabel = (act) => act.durationLabelKey ? t(act.durationLabelKey) : (act.durationLabel || '');

// --- GENERADOR DE INFORME FINAL ---
const generateReport = (criticals, warnings, factors) => {
    const sortedFactors = prioritizeFactors(factors);
    const legacyFactors = mapFactorsToLegacy(sortedFactors);
    const base = { sortedFactors, factors: legacyFactors };
    if (criticals.length > 0) {
        return { ...base, status: 'red', message: t('activities.conditionsOutOfRange', { count: criticals.length }), analysis: criticals.join(". ") + "." };
    }
    if (warnings.length > 0) {
        return { ...base, status: 'yellow', message: t('activities.warnings', { count: warnings.length }), analysis: warnings.join(". ") + "." };
    }
    return { ...base, status: 'green', message: t('activities.idealConditions'), analysis: t('activities.allParamsOptimal') };
};

// ==========================================
// 1. EVALUADOR ESTÁNDAR (Running)
// Sensación: apparentTemperature si existe, si no temperature
// ==========================================
const evaluateStandardActivity = (data, rules) => {
    const { temp, apparentTemp, rainMM, snowCM, snowDepth, wind, rainProb, isSnow, isFloorWet, weatherCode, usAqi, isSanitizedToCloudy, humidity, uvIndex, visibilityM } = data;
    let criticals = []; let warnings = [];
    const sensacion = apparentTemp != null ? apparentTemp : temp;
    const tempLabel = apparentTemp != null ? t('common.sensation') : t('common.temp');

    let fTemp = createFactor('TEMP', `${Math.round(sensacion)}°`, 'SAFE', tempLabel, '', 0);
    if (sensacion < SAFETY_LIMITS.RUNNING_COLD_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(sensacion)}°`, 'CRITICAL', tempLabel, `${t('activities.dangerCold')} (${Math.round(sensacion)}°)`, 100); criticals.push(`${t('activities.dangerCold')} (${Math.round(sensacion)}°)`); }
    else if (sensacion < SAFETY_LIMITS.RUNNING_COLD_WARNING) { fTemp = createFactor('TEMP', `${Math.round(sensacion)}°`, 'CRITICAL', tempLabel, `${t('activities.veryCold')} (${Math.round(sensacion)}°)`, 90); criticals.push(`${t('activities.veryCold')} (${Math.round(sensacion)}°)`); }
    else if (sensacion < SAFETY_LIMITS.RUNNING_COLD_WARNING + 5) { fTemp = createFactor('TEMP', `${Math.round(sensacion)}°`, 'WARNING', tempLabel, `${t('activities.intenseCold')} (${Math.round(sensacion)}°)`, 50); warnings.push(`${t('activities.intenseCold')} (${Math.round(sensacion)}°)`); }
    else if (sensacion > SAFETY_LIMITS.RUNNING_HEAT_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(sensacion)}°`, 'CRITICAL', tempLabel, t('activities.heatStrokeRisk'), 95); criticals.push(t('activities.heatStrokeRisk')); }
    else if (sensacion > SAFETY_LIMITS.RUNNING_HEAT_WARNING) { fTemp = createFactor('TEMP', `${Math.round(sensacion)}°`, 'WARNING', tempLabel, t('activities.excessiveHeat'), 60); warnings.push(t('activities.excessiveHeat')); }

    const isHailOrIceRain = weatherCode != null && WMO_HAIL_OR_ICE_RAIN.includes(weatherCode);
    const pVal = isSnow ? snowCM : rainMM;
    const pName = isSnow ? t('weather.snow') : t('activities.rain');
    const pUnit = isSnow ? 'cm' : 'mm';
    let fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', `${pVal}${pUnit}`, 'SAFE', pName, '', 0);
    if (!isSanitizedToCloudy) {
        if (isHailOrIceRain) { fPrecip = createFactor('PRECIP', `${pVal}${pUnit}`, 'CRITICAL', pName, t('activities.hailOrIceRain'), 100); criticals.push(t('activities.hailOrIceRain')); }
        else if (pVal > SAFETY_LIMITS.RUNNING_RAIN_WARNING_MM) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', `${pVal}${pUnit}`, 'WARNING', pName, t('activities.intenseRain', { name: pName }), 70); warnings.push(t('activities.intenseRain', { name: pName })); }
        else if (pVal > 0 || (rainProb > 40 && pVal === 0)) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', `${pVal}${pUnit}`, 'WARNING', pName, t('activities.rainRisk', { name: pName }), 40); warnings.push(t('activities.rainRisk', { name: pName })); }
    } else {
        fPrecip = createFactor('PRECIP', `0${pUnit}`, 'SAFE', pName, '', 0);
    }

    let fWind = createFactor('WIND', `${wind} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (wind > SAFETY_LIMITS.RUNNING_WIND_CRITICAL) { fWind = createFactor('WIND', `${wind} km/h`, 'CRITICAL', t('activities.wind'), t('activities.strongWind'), 85); criticals.push(t('activities.strongWind')); }
    else if (wind > SAFETY_LIMITS.RUNNING_WIND_WARNING) { fWind = createFactor('WIND', `${wind} km/h`, 'WARNING', t('activities.wind'), t('activities.moderateWind'), 50); warnings.push(t('activities.moderateWind')); }

    let fSoil = createFactor('GROUND', t('activities.dry'), 'SAFE', t('activities.ground'), '', 0);
    if (snowDepth > 0) {
        fSoil = createFactor('GROUND', `${t('weather.snow')} ${Math.round(snowDepth*100)}cm`, 'WARNING', t('activities.ground'), t('activities.snowyGround'), 60);
        if (snowDepth > 0.05 && !isSnow) { fSoil = createFactor('GROUND', `${t('weather.snow')} ${Math.round(snowDepth*100)}cm`, 'CRITICAL', t('activities.ground'), t('activities.snowAccumulated'), 90); criticals.push(t('activities.snowAccumulated')); }
        else { warnings.push(t('activities.snowyGround')); }
    } else if (isFloorWet) {
        fSoil = createFactor('GROUND', t('activities.wet'), rules.checkWetFloor ? 'WARNING' : 'SAFE', t('activities.ground'), rules.checkWetFloor ? t('activities.wetGround') : '', rules.checkWetFloor ? 30 : 0);
        if (rules.checkWetFloor) warnings.push(t('activities.wetGround'));
    }

    const factors = [fTemp, fPrecip, fWind, fSoil];

    // AQI: solo si los datos incluyen us_aqi
    if (usAqi != null) {
        const aqiStatus = usAqi > SAFETY_LIMITS.AQI_CRITICAL_RUNNING ? 'CRITICAL' : 'SAFE';
        const aqiDesc = usAqi > SAFETY_LIMITS.AQI_CRITICAL_RUNNING ? t('activities.poorAirQuality') : '';
        if (aqiStatus === 'CRITICAL') criticals.push(t('activities.poorAirQuality'));
        factors.push(createFactor('AQI', String(usAqi), aqiStatus, 'AQI', aqiDesc, aqiStatus === 'CRITICAL' ? 80 : 0));
    }

    // Humedad: si existe y es relevante para running (discomfort en calor)
    if (humidity != null && sensacion > 25) {
        const humStatus = humidity > 85 ? 'WARNING' : humidity > 75 ? 'WARNING' : 'SAFE';
        if (humStatus === 'WARNING') warnings.push(t('activities.highHumidity'));
        factors.push(createFactor('HUMIDITY', `${Math.round(humidity)}%`, humStatus, t('activities.humidity'), humStatus === 'WARNING' ? t('activities.highHumidity') : '', humStatus === 'WARNING' ? 35 : 0));
    }

    // UV: si existe (requiere uv_index en hourly)
    if (uvIndex != null) {
        let uvStatus = 'SAFE', uvDesc = '';
        if (uvIndex >= SAFETY_LIMITS.UV_EXTREME) { uvStatus = 'CRITICAL'; uvDesc = t('activities.uvExtreme'); criticals.push(uvDesc); }
        else if (uvIndex >= SAFETY_LIMITS.UV_MODERATE) { uvStatus = 'WARNING'; uvDesc = t('activities.uvHigh'); warnings.push(uvDesc); }
        factors.push(createFactor('UV', String(Math.round(uvIndex)), uvStatus, t('activities.uv'), uvDesc, uvStatus === 'CRITICAL' ? 75 : uvStatus === 'WARNING' ? 45 : 0));
    }

    // Visibilidad en metros: si existe
    if (visibilityM != null) {
        let visStatus = 'SAFE', visDesc = '';
        if (visibilityM < SAFETY_LIMITS.VISIBILITY_CRITICAL_M) { visStatus = 'CRITICAL'; visDesc = t('activities.veryPoorVisibility'); criticals.push(visDesc); }
        else if (visibilityM < SAFETY_LIMITS.VISIBILITY_POOR_M) { visStatus = 'WARNING'; visDesc = t('activities.reducedVisibility'); warnings.push(visDesc); }
        factors.push(createFactor('VISIBILITY', `${visibilityM} m`, visStatus, t('activities.visibilityM'), visDesc, visStatus === 'CRITICAL' ? 85 : visStatus === 'WARNING' ? 55 : 0));
    }

    return generateReport(criticals, warnings, factors);
};

// ==========================================
// 2. EVALUADOR MOTO
// Visibilidad: inferida por código WMO (45/48 = niebla). TODO: valor en m si API lo ofrece
// ==========================================
const evaluateMotoActivity = (data, rules) => {
    const { temp, apparentTemp, rainMM, snowCM, snowDepth, wind, isSnow, isFloorWet, code, rainProb = 0, visibilityM } = data;
    const sensacion = apparentTemp != null ? apparentTemp : temp;
    const tempLabel = apparentTemp != null ? t('common.sensation') : t('common.temp');
    let criticals = []; let warnings = [];

    const tempDisplay = Math.round(sensacion);
    let fTemp = createFactor('TEMP', `${tempDisplay}°`, 'SAFE', tempLabel, '', 0);
    if (sensacion >= SAFETY_LIMITS.MOTO_HEAT_CRITICAL) { fTemp = createFactor('TEMP', `${tempDisplay}°`, 'CRITICAL', tempLabel, t('activities.heatStrokeRisk'), 95); criticals.push(t('activities.heatStrokeRisk')); }
    else if (sensacion >= SAFETY_LIMITS.MOTO_HEAT_WARNING) { fTemp = createFactor('TEMP', `${tempDisplay}°`, 'WARNING', tempLabel, t('activities.excessiveHeat'), 60); warnings.push(t('activities.excessiveHeat')); }
    else if (sensacion < SAFETY_LIMITS.MOTO_MIN_TEMP) { fTemp = createFactor('TEMP', `${tempDisplay}°`, 'CRITICAL', tempLabel, t('activities.iceRisk'), 95); criticals.push(t('activities.iceRisk')); }
    else if (sensacion < SAFETY_LIMITS.MOTO_TEMP_WARNING) { fTemp = createFactor('TEMP', `${tempDisplay}°`, 'WARNING', tempLabel, t('activities.intenseCold'), 50); warnings.push(t('activities.intenseCold')); }

    let fWind = createFactor('WIND', `${wind} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (wind > SAFETY_LIMITS.MOTO_MAX_WIND) { fWind = createFactor('WIND', `${wind} km/h`, 'CRITICAL', t('activities.wind'), t('activities.dangerousWind'), 100); criticals.push(t('activities.dangerousWind')); }
    else if (wind > SAFETY_LIMITS.MOTO_WIND_WARNING) { fWind = createFactor('WIND', `${wind} km/h`, 'WARNING', t('activities.wind'), t('activities.annoyingWind'), 55); warnings.push(t('activities.annoyingWind')); }

    let fRoad = createFactor('ROAD', t('activities.dryRoad'), 'SAFE', t('activities.road'), '', 0);
    if (snowDepth > 0 || isSnow) {
        fRoad = createFactor('ROAD', snowDepth > 0 ? `${Math.round(snowDepth*100)}cm` : `${snowCM}cm`, 'CRITICAL', t('weather.snow'), t('activities.snowOnRoad'), 100);
        criticals.push(t('activities.snowOnRoad'));
    } else if (rainMM > SAFETY_LIMITS.MOTO_RAIN_CRITICAL_MM) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.raining'), t('activities.activePrecip'), 95);
        criticals.push(t('activities.activePrecip'));
    } else if (rainMM >= SAFETY_LIMITS.MOTO_RAIN_ACTIVE_MM) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.raining'), t('activities.activePrecip'), 95);
        criticals.push(t('activities.activePrecip'));
    } else if (rainMM >= 0.1) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'WARNING', t('activities.raining'), t('activities.rainRisk', { name: t('activities.rain') }), 60);
        warnings.push(t('activities.rainRisk', { name: t('activities.rain') }));
    } else if (rainProb > SAFETY_LIMITS.MOTO_RAIN_PROB_WARNING && rainMM > 0) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'WARNING', t('activities.raining'), t('activities.rainRisk', { name: t('activities.rain') }), 50);
        warnings.push(t('activities.rainRisk', { name: t('activities.rain') }));
    } else if (isFloorWet) {
        fRoad = createFactor('ROAD', t('activities.wetRoad'), 'WARNING', t('activities.road'), t('activities.wetAsphalt'), 40);
        warnings.push(t('activities.wetAsphalt'));
    }

    let fVis = createFactor('VISIBILITY', t('activities.good'), 'SAFE', t('activities.visibility'), '', 0);
    if (visibilityM != null) {
        if (visibilityM < SAFETY_LIMITS.VISIBILITY_CRITICAL_M) { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'CRITICAL', t('activities.visibilityM'), t('activities.veryPoorVisibility'), 100); criticals.push(t('activities.veryPoorVisibility')); }
        else if (visibilityM < SAFETY_LIMITS.VISIBILITY_POOR_M) { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'WARNING', t('activities.visibilityM'), t('activities.reducedVisibility'), 70); warnings.push(t('activities.reducedVisibility')); }
        else if (rainMM > 2.0 || isSnow) { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'WARNING', t('activities.visibilityM'), t('activities.regular'), 45); warnings.push(t('activities.regular')); }
        else { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'SAFE', t('activities.visibilityM'), '', 0); }
    } else {
        if (code === 48) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'CRITICAL', t('activities.visibility'), t('activities.veryPoorVisibility'), 100); criticals.push(t('activities.veryPoorVisibility')); }
        else if (code === 45) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'WARNING', t('activities.visibility'), t('activities.reducedVisibility'), 70); warnings.push(t('activities.reducedVisibility')); }
        else if (rainMM > 2.0 || isSnow) { fVis = createFactor('VISIBILITY', t('activities.regular'), 'WARNING', t('activities.visibility'), t('activities.regular'), 45); warnings.push(t('activities.regular')); }
    }

    const factors = [fTemp, fWind, fRoad, fVis];
    return generateReport(criticals, warnings, factors);
};

// ==========================================
// 3. EVALUADOR COLADA
// Humedad >70% adv, >85% crítico; Temp <10° adv, <5° crítico; Viento <5 estancado adv, >40 crítico; Cualquier precipitación crítico
// ==========================================
const evaluateLaundryActivity = (data, hourlyData, startIndex) => {
    const { temp, isSnow, wind, rainMM, rainProb, isSanitizedToCloudy } = data;
    let criticals = []; let warnings = [];

    const tempDisplay = Math.round(temp);
    let fTemp = createFactor('TEMP', `${tempDisplay}°`, 'SAFE', t('common.temp'), '', 0);
    if (temp < SAFETY_LIMITS.LAUNDRY_TEMP_CRITICAL) { fTemp = createFactor('TEMP', `${tempDisplay}°`, 'CRITICAL', t('common.temp'), t('activities.freezing'), 95); criticals.push(t('activities.freezing')); }
    else if (temp < SAFETY_LIMITS.LAUNDRY_TEMP_WARNING) { fTemp = createFactor('TEMP', `${tempDisplay}°`, 'WARNING', t('common.temp'), t('activities.intenseCold'), 50); warnings.push(t('activities.intenseCold')); }

    const humidity = hourlyData.relative_humidity_2m[startIndex];
    let fHum = createFactor('HUMIDITY', `${Math.round(humidity)}%`, 'SAFE', t('activities.humidity'), '', 0);
    if (humidity > SAFETY_LIMITS.LAUNDRY_HUMIDITY_CRITICAL) { fHum = createFactor('HUMIDITY', `${Math.round(humidity)}%`, 'CRITICAL', t('activities.humidity'), t('activities.highHumidity'), 90); criticals.push(t('activities.highHumidity')); }
    else if (humidity > SAFETY_LIMITS.LAUNDRY_HUMIDITY_WARNING) { fHum = createFactor('HUMIDITY', `${Math.round(humidity)}%`, 'WARNING', t('activities.humidity'), t('activities.highHumidity'), 55); warnings.push(t('activities.highHumidity')); }

    // Lluvia colada: mm + probabilidad. Verde solo si ambos despreciables.
    let rainTotal = 0; let maxProb = 0;
    const limit = Math.min(startIndex + 12, hourlyData.time.length);
    for (let i = startIndex; i < limit; i++) {
        rainTotal += hourlyData.precipitation[i] ?? 0;
        const hProb = hourlyData.precipitation_probability?.[i] ?? 0;
        maxProb = Math.max(maxProb, hProb);
    }
    const { LAUNDRY_RAIN_MM_SAFE, LAUNDRY_RAIN_MM_DRIZZLE, LAUNDRY_RAIN_PROB_WARNING, LAUNDRY_RAIN_PROB_CRITICAL } = SAFETY_LIMITS;

    const isGreen = rainTotal < LAUNDRY_RAIN_MM_SAFE && maxProb < LAUNDRY_RAIN_PROB_WARNING;
    const isRed = maxProb >= LAUNDRY_RAIN_PROB_CRITICAL || rainTotal >= LAUNDRY_RAIN_MM_DRIZZLE;
    const isYellowA = !isRed && rainTotal < LAUNDRY_RAIN_MM_SAFE && maxProb >= LAUNDRY_RAIN_PROB_WARNING && maxProb < LAUNDRY_RAIN_PROB_CRITICAL;
    const isYellowB = !isRed && rainTotal > 0 && rainTotal < LAUNDRY_RAIN_MM_DRIZZLE && maxProb > LAUNDRY_RAIN_PROB_WARNING;

    let fRain;
    if (isRed) {
        const displayVal = rainTotal > LAUNDRY_RAIN_MM_DRIZZLE ? `${rainTotal.toFixed(1)}mm` : `${Math.round(maxProb)}%`;
        fRain = createFactor('PRECIP', displayVal, 'CRITICAL', t('activities.rainExpected'), t('activities.rainExpected'), 100);
        criticals.push(t('activities.rainExpected'));
    } else if (isYellowB) {
        fRain = createFactor('PRECIP', `${Math.round(maxProb)}%`, 'WARNING', t('activities.possibleDrizzle'), t('activities.possibleDrizzle'), 55);
        warnings.push(t('activities.possibleDrizzle'));
    } else if (isYellowA) {
        fRain = createFactor('PRECIP', `${Math.round(maxProb)}%`, 'WARNING', t('activities.rainProbability'), t('activities.rainProbWarning'), 55);
        warnings.push(t('activities.rainProbWarning'));
    } else {
        const safeVal = rainTotal < 0.01 ? t('activities.noRisk') : '0mm';
        fRain = createFactor('PRECIP', safeVal, 'SAFE', t('activities.rain'), '', 0);
    }

    let fWind = createFactor('WIND', `${wind} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (wind > SAFETY_LIMITS.LAUNDRY_MAX_WIND) { fWind = createFactor('WIND', `${wind} km/h`, 'CRITICAL', t('activities.wind'), t('activities.clothesFlying'), 85); criticals.push(t('activities.clothesFlying')); }
    else if (wind < SAFETY_LIMITS.LAUNDRY_STAGNANT_WIND) { fWind = createFactor('WIND', t('activities.stagnant'), 'WARNING', t('activities.wind'), t('activities.stagnantAir'), 40); warnings.push(t('activities.stagnantAir')); }
    else if (wind < SAFETY_LIMITS.LAUNDRY_STAGNANT_WIND + 5 && humidity > SAFETY_LIMITS.LAUNDRY_HUMIDITY_WARNING) { fWind = createFactor('WIND', `${wind} km/h`, 'WARNING', t('activities.wind'), t('activities.stagnantAir'), 35); warnings.push(t('activities.stagnantAir')); }

    return generateReport(criticals, warnings, [fTemp, fHum, fRain, fWind]);
};

// --- MATRIZ DE RIESGO DE LLUVIA (reutilizable para filtros) ---
/** Calcula el estado de riesgo de lluvia (green/yellow/red) para una ventana horaria. */
export const getRainRiskState = (hourlyData, startIndex, windowHours = 12) => {
    if (!hourlyData?.time || startIndex < 0 || startIndex >= hourlyData.time.length) return 'green';
    const { LAUNDRY_RAIN_MM_SAFE, LAUNDRY_RAIN_MM_DRIZZLE, LAUNDRY_RAIN_PROB_WARNING, LAUNDRY_RAIN_PROB_CRITICAL } = SAFETY_LIMITS;
    let rainTotal = 0; let maxProb = 0;
    const limit = Math.min(startIndex + windowHours, hourlyData.time.length);
    for (let i = startIndex; i < limit; i++) {
        rainTotal += hourlyData.precipitation?.[i] ?? 0;
        maxProb = Math.max(maxProb, hourlyData.precipitation_probability?.[i] ?? 0);
    }
    const isGreen = rainTotal < LAUNDRY_RAIN_MM_SAFE && maxProb < LAUNDRY_RAIN_PROB_WARNING;
    const isRed = maxProb >= LAUNDRY_RAIN_PROB_CRITICAL || rainTotal >= LAUNDRY_RAIN_MM_DRIZZLE;
    const isYellowA = !isRed && rainTotal < LAUNDRY_RAIN_MM_SAFE && maxProb >= LAUNDRY_RAIN_PROB_WARNING && maxProb < LAUNDRY_RAIN_PROB_CRITICAL;
    const isYellowB = !isRed && rainTotal > 0 && rainTotal < LAUNDRY_RAIN_MM_DRIZZLE && maxProb > LAUNDRY_RAIN_PROB_WARNING;
    if (isRed) return 'red';
    if (isYellowA || isYellowB) return 'yellow';
    return 'green';
};

/** true si en las 3 horas previas hubo estado ROJO (lluvia significativa). */
export const hadRedRainInPreviousHours = (hourlyData, startIndex, count = 3) => {
    if (!hourlyData?.time || startIndex < 1) return false;
    for (let k = 1; k <= count && startIndex - k >= 0; k++) {
        const state = getRainRiskState(hourlyData, startIndex - k, 1);
        if (state === 'red') return true;
    }
    return false;
};

// ==========================================
// FUNCIÓN PRINCIPAL
// ==========================================
export const checkActivityRules = (hourlyData, startIndex, durationMinutes, rules, options = {}) => {
    const { interpolatedTemp, interpolatedFeelsLike } = options;
    if (!hourlyData || !hourlyData.time || startIndex < 0 || startIndex >= hourlyData.time.length) {
        const placeholderFactors = [
            createFactor('TEMP', '--', 'INFO', 'Data', '', 0),
            createFactor('WIND', '--', 'INFO', 'Data', '', 0),
            createFactor('PRECIP', '--', 'INFO', 'Data', '', 0),
            createFactor('GROUND', '--', 'INFO', 'Data', '', 0),
        ];
        return { 
            status: 'gray', 
            message: t('activities.noData'), 
            analysis: t('activities.infoUnavailable'), 
            sortedFactors: placeholderFactors,
            factors: mapFactorsToLegacy(placeholderFactors)
        };
    }

    const i = startIndex;
    const rawTemp = hourlyData.temperature_2m[i];
    const rawApparentTemp = hourlyData.apparent_temperature?.[i] ?? null;
    const temp = (interpolatedTemp != null && typeof interpolatedTemp === 'number') ? interpolatedTemp : rawTemp;
    const apparentTemp = (interpolatedFeelsLike != null && typeof interpolatedFeelsLike === 'number') ? interpolatedFeelsLike : rawApparentTemp;
    const rainProb = hourlyData.precipitation_probability?.[i] ?? 0;
    const rainMM = hourlyData.precipitation[i];
    const snowCM = hourlyData.snowfall ? hourlyData.snowfall[i] : 0;
    const snowDepth = hourlyData.snow_depth ? hourlyData.snow_depth[i] : 0;
    const wind = Math.round(hourlyData.wind_speed_10m[i]);
    const code = hourlyData.weather_code[i];
    const weatherCode = code;
    const humidity = hourlyData.relative_humidity_2m?.[i] ?? null;
    const usAqi = hourlyData.us_aqi?.[i] ?? null;
    const uvIndex = hourlyData.uv_index?.[i] ?? null;
    const visibilityM = hourlyData.visibility_10m?.[i] ?? null;

    const isSnow = snowCM > 0 || (rawTemp < 2 && rainMM > 0);
    const isFloorWet = (startIndex >= 2)
        ? hourlyData.precipitation.slice(startIndex - 2, startIndex).reduce((a, b) => a + b, 0) > 0.5
        : false;

    // Sanitización consistente con Home/Rutas: descarta lluvias de baja probabilidad o intensidad irrelevante.
    // Moto NO usa sanitizado: sus reglas de seguridad manejan su propia sensibilidad (rainProb > 15, etc.).
    const sanitizedCode = sanitizeCode(code, rainMM, rainProb);

    const analysisData = {
        temp,
        apparentTemp: apparentTemp != null ? apparentTemp : null,
        rainMM, snowCM, snowDepth, wind, rainProb, isSnow, isFloorWet, humidity, usAqi,
        uvIndex, visibilityM,
        // Standard/Laundry usan código sanitizado para consistencia con Home.
        // Moto mantiene código raw: sus reglas de seguridad (rainProb > 15, etc.) manejan su propia sensibilidad.
        code: rules.mode === 'moto' ? code : sanitizedCode,
        weatherCode: rules.mode === 'moto' ? code : sanitizedCode,
        isSanitizedToCloudy: sanitizedCode === 3
    };

    try {
        if (rules.mode === 'moto') return evaluateMotoActivity(analysisData, rules);
        if (rules.mode === 'laundry') return evaluateLaundryActivity(analysisData, hourlyData, startIndex);
        return evaluateStandardActivity(analysisData, rules);
    } catch (e) {
        console.error("Rules Error:", e);
        return { status: 'gray', message: t('activities.error'), analysis: t('activities.internalError'), sortedFactors: [], factors: [] };
    }
};