/**
 * safetyRules.js — Fuente única de verdad para evaluación de seguridad (verde/amarillo/rojo).
 * Usado por useRouteWeather (rutas: moto, coche, bici, pie) y activitiesConfig (actividades: moto, running, colada).
 * Umbrales y lógica de factores definidos una sola vez para evitar desincronización.
 */

// --- Umbrales unificados (rutas + actividades) ---
export const SAFETY_LIMITS = {
    // Moto (rutas y actividad moto)
    MOTO_WIND_WARNING: 30,
    MOTO_WIND_CRITICAL: 45,
    MOTO_MAX_WIND: 45,
    MOTO_TEMP_WARNING: 5,
    MOTO_TEMP_CRITICAL: 2,
    MOTO_MIN_TEMP: 2,
    MOTO_RAIN_WARNING_MAX: 0.5,
    MOTO_RAIN_ACTIVE_MM: 0.5,
    MOTO_RAIN_CRITICAL: 4.0,
    MOTO_RAIN_CRITICAL_MM: 4.0,
    MOTO_RAIN_PROB_WARNING: 15,
    MOTO_HEAT_WARNING: 30,
    MOTO_HEAT_CRITICAL: 35,
    MOTO_VIS_WARNING_M: 1000,
    MOTO_VIS_CRITICAL_M: 200,
    // Calor/humedad genéricos (rutas)
    HEAT_WARNING: 30,
    HEAT_CRITICAL: 35,
    HUMIDITY_WARNING: 70,
    HUMIDITY_CRITICAL: 85,
    AQI_CRITICAL: 150,
    // Coche (rutas)
    CAR_RAIN_WARNING: 2.5,
    CAR_RAIN_CRITICAL: 7.6,
    CAR_WIND_WARNING: 60,
    CAR_WIND_CRITICAL: 90,
    CAR_VIS_WARNING_M: 500,
    CAR_VIS_CRITICAL_M: 50,
    // Pie (rutas)
    WALK_RAIN_WARNING: 0.5,
    WALK_RAIN_CRITICAL: 4.0,
    WALK_WIND_WARNING: 25,
    WALK_WIND_CRITICAL: 40,
    WALK_HEAT_CRITICAL: 35,
    // Running (actividades)
    HUMAN_MIN_TEMP: -10,
    HUMAN_MAX_TEMP: 32,
    RUNNING_WIND_WARNING: 30,
    RUNNING_WIND_CRITICAL: 50,
    RUNNING_HEAT_WARNING: 27,
    RUNNING_HEAT_CRITICAL: 32,
    RUNNING_COLD_WARNING: 0,
    RUNNING_COLD_CRITICAL: -10,
    RUNNING_RAIN_WARNING_MM: 0.5,
    AQI_CRITICAL_RUNNING: 150,
    UV_EXTREME: 11,
    UV_HIGH: 8,
    UV_MODERATE: 6,
    VISIBILITY_POOR_M: 1000,
    VISIBILITY_CRITICAL_M: 200,
    // Colada (actividades)
    LAUNDRY_MAX_WIND: 40,
    LAUNDRY_STAGNANT_WIND: 5,
    LAUNDRY_HUMIDITY_WARNING: 70,
    LAUNDRY_HUMIDITY_CRITICAL: 85,
    LAUNDRY_TEMP_WARNING: 10,
    LAUNDRY_TEMP_CRITICAL: 5,
    LAUNDRY_RAIN_PROB_WARNING: 20,
    LAUNDRY_RAIN_PROB_CRITICAL: 50,
    LAUNDRY_RAIN_MM_SAFE: 0.15,
    LAUNDRY_RAIN_MM_DRIZZLE: 0.5,
};

/** Crea un factor estandarizado: type, value, status, label, description, score */
export const createFactor = (type, value, status, label, description = '', score = 0) => ({
    type, value, status, label, description, score
});

const L = SAFETY_LIMITS;

/**
 * Normaliza datos de pronóstico para que rutas (windSpeed, code) y actividades (wind, weatherCode, visibilityM, rainProb) compartan la misma forma.
 */
const normalizeData = (data) => ({
    ...data,
    windSpeed: data.windSpeed ?? data.wind,
    code: data.code ?? data.weatherCode ?? 0,
    rainProb: data.rainProb ?? 0,
    visibilityM: data.visibilityM ?? null,
});

/**
 * Evaluador Moto — Rutas y actividad "moto".
 * Misma lógica que antes en useRouteWeather + actividadesConfig (visibilidad por código WMO o por metros si existe).
 */
export function evaluateMoto(data, t) {
    const d = normalizeData(data);
    const { temp, apparentTemp, rainMM, snowCM, snowDepth, windSpeed, isFloorWet, code, humidity, usAqi, rainProb, visibilityM } = d;
    const tempToUse = apparentTemp != null ? apparentTemp : temp;
    const tempLabel = apparentTemp != null ? t('common.sensation') : t('common.temp');
    const isSnow = snowCM > 0;
    let criticals = []; let warnings = [];

    let fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'SAFE', tempLabel, '', 0);
    if (tempToUse >= L.HEAT_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'CRITICAL', tempLabel, t('activities.heatStrokeRisk'), 95); criticals.push(t('activities.heatStrokeRisk')); }
    else if (tempToUse >= L.HEAT_WARNING) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'WARNING', tempLabel, t('activities.excessiveHeat'), 60); warnings.push(t('activities.excessiveHeat')); }
    else if (tempToUse < L.MOTO_TEMP_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'CRITICAL', tempLabel, t('activities.iceRisk'), 95); criticals.push(t('activities.iceRisk')); }
    else if (tempToUse < L.MOTO_TEMP_WARNING) { fTemp = createFactor('TEMP', `${Math.round(tempToUse)}°`, 'WARNING', tempLabel, t('activities.intenseCold'), 50); warnings.push(t('activities.intenseCold')); }

    let fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (windSpeed > L.MOTO_WIND_CRITICAL) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'CRITICAL', t('activities.wind'), t('activities.dangerousWind'), 100); criticals.push(t('activities.dangerousWind')); }
    else if (windSpeed > L.MOTO_WIND_WARNING) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'WARNING', t('activities.wind'), t('activities.annoyingWind'), 55); warnings.push(t('activities.annoyingWind')); }

    let fRoad = createFactor('ROAD', t('activities.dryRoad'), 'SAFE', t('activities.road'), '', 0);
    if (snowDepth > 0 || isSnow) {
        fRoad = createFactor('ROAD', snowDepth > 0 ? `${Math.round(snowDepth * 100)}cm` : `${snowCM}cm`, 'CRITICAL', t('weather.snow'), t('activities.snowOnRoad'), 100);
        criticals.push(t('activities.snowOnRoad'));
    } else if (rainMM > L.MOTO_RAIN_CRITICAL) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.raining'), t('activities.activePrecip'), 95);
        criticals.push(t('activities.activePrecip'));
    } else if (rainMM >= L.MOTO_RAIN_ACTIVE_MM) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.raining'), t('activities.activePrecip'), 95);
        criticals.push(t('activities.activePrecip'));
    } else if (rainMM >= 0.1) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'WARNING', t('activities.raining'), t('activities.rainRisk', { name: t('activities.rain') }), 60);
        warnings.push(t('activities.rainRisk', { name: t('activities.rain') }));
    } else if (rainProb > L.MOTO_RAIN_PROB_WARNING && rainMM > 0) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'WARNING', t('activities.raining'), t('activities.rainRisk', { name: t('activities.rain') }), 50);
        warnings.push(t('activities.rainRisk', { name: t('activities.rain') }));
    } else if (isFloorWet) {
        fRoad = createFactor('ROAD', t('activities.wetRoad'), 'WARNING', t('activities.road'), t('activities.wetAsphalt'), 40);
        warnings.push(t('activities.wetAsphalt'));
    }

    const precipValue = rainMM === 0 ? '0 mm' : `${Number(rainMM).toFixed(1)} mm`;
    const fPrecip = createFactor('PRECIP', precipValue, 'SAFE', t('activities.rain'), '', 0);
    const roadShowsRainMm = rainMM >= 0.1;

    let fVis = createFactor('VISIBILITY', t('activities.good'), 'SAFE', t('activities.visibility'), '', 0);
    if (visibilityM != null) {
        if (visibilityM < L.MOTO_VIS_CRITICAL_M) { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'CRITICAL', t('activities.visibilityM'), t('activities.veryPoorVisibility'), 100); criticals.push(t('activities.veryPoorVisibility')); }
        else if (visibilityM < L.MOTO_VIS_WARNING_M) { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'WARNING', t('activities.visibilityM'), t('activities.reducedVisibility'), 70); warnings.push(t('activities.reducedVisibility')); }
        else if (rainMM > 2.0 || isSnow) { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'WARNING', t('activities.visibilityM'), t('activities.regular'), 45); warnings.push(t('activities.regular')); }
        else { fVis = createFactor('VISIBILITY', `${visibilityM} m`, 'SAFE', t('activities.visibilityM'), '', 0); }
    } else {
        if (code === 48) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'CRITICAL', t('activities.visibility'), t('activities.veryPoorVisibility'), 100); criticals.push(t('activities.veryPoorVisibility')); }
        else if (code === 45) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'WARNING', t('activities.visibility'), t('activities.reducedVisibility'), 70); warnings.push(t('activities.reducedVisibility')); }
        else if (rainMM > 2.0 || isSnow) { fVis = createFactor('VISIBILITY', t('activities.regular'), 'WARNING', t('activities.visibility'), t('activities.regular'), 45); warnings.push(t('activities.regular')); }
    }

    const factors = roadShowsRainMm ? [fTemp, fWind, fRoad, fVis] : [fTemp, fWind, fRoad, fPrecip, fVis];

    if (humidity != null && tempToUse > 25) {
        const humStatus = humidity > L.HUMIDITY_CRITICAL ? 'CRITICAL' : humidity > L.HUMIDITY_WARNING ? 'WARNING' : 'SAFE';
        if (humStatus === 'CRITICAL') criticals.push(t('activities.highHumidity'));
        else if (humStatus === 'WARNING') warnings.push(t('activities.highHumidity'));
        factors.push(createFactor('HUMIDITY', `${Math.round(humidity)}%`, humStatus, t('activities.humidity'), humStatus !== 'SAFE' ? t('activities.highHumidity') : '', humStatus === 'CRITICAL' ? 70 : 40));
    }
    if (usAqi != null) {
        const aqiStatus = usAqi > L.AQI_CRITICAL ? 'CRITICAL' : 'SAFE';
        if (aqiStatus === 'CRITICAL') criticals.push(t('activities.poorAirQuality'));
        factors.push(createFactor('AQI', String(usAqi), aqiStatus, 'AQI', aqiStatus === 'CRITICAL' ? t('activities.poorAirQuality') : '', aqiStatus === 'CRITICAL' ? 75 : 0));
    }

    return { criticals, warnings, factors };
}

/**
 * Evaluador Coche — Rutas.
 */
export function evaluateCar(data, t) {
    const d = normalizeData(data);
    const { temp, rainMM, snowCM, snowDepth, windSpeed, code, isFloorWet } = d;
    const isSnow = snowCM > 0;
    const iceRisk = temp < 0 && (rainMM > 0 || isFloorWet);
    let criticals = []; let warnings = [];

    let fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'SAFE', t('common.temp'), '', 0);
    if (iceRisk) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'CRITICAL', t('common.temp'), t('routes.severeIce'), 95); criticals.push(t('routes.severeIce')); }
    else if (temp < 0) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'WARNING', t('common.temp'), t('routes.possibleIce'), 50); warnings.push(t('routes.possibleIce')); }

    let fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (windSpeed > L.CAR_WIND_CRITICAL) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'CRITICAL', t('activities.wind'), t('routes.hurricaneWind'), 100); criticals.push(t('routes.hurricaneWind')); }
    else if (windSpeed > L.CAR_WIND_WARNING) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'WARNING', t('activities.wind'), t('activities.strongWind'), 65); warnings.push(t('activities.strongWind')); }

    let fRoad = createFactor('ROAD', t('activities.dry'), 'SAFE', t('activities.rain'), '', 0);
    if (snowDepth > 0) {
        fRoad = createFactor('ROAD', `${Math.round(snowDepth * 100)}cm`, 'CRITICAL', t('weather.snow'), t('routes.snowyRoad'), 100);
        criticals.push(t('routes.snowyRoad'));
    } else if (isSnow) {
        fRoad = createFactor('ROAD', `${snowCM}cm`, 'CRITICAL', t('weather.snow'), t('activities.snowing'), 95);
        criticals.push(t('activities.snowing'));
    } else if (rainMM > L.CAR_RAIN_CRITICAL) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'CRITICAL', t('activities.rain'), t('routes.torrentialRain'), 90);
        criticals.push(t('routes.torrentialRain'));
    } else if (rainMM > L.CAR_RAIN_WARNING) {
        fRoad = createFactor('ROAD', `${rainMM}mm`, 'WARNING', t('activities.rain'), t('routes.rainOnRoute'), 60);
        warnings.push(t('routes.rainOnRoute'));
    } else if (rainMM > 0) {
        fRoad = createFactor('ROAD', t('weather.drizzle'), 'SAFE', t('activities.rain'), '', 0);
    }

    const precipValueCar = rainMM === 0 ? '0 mm' : `${Number(rainMM).toFixed(1)} mm`;
    const fPrecipCar = createFactor('PRECIP', precipValueCar, 'SAFE', t('activities.rain'), '', 0);
    const roadShowsRainMmCar = rainMM > L.CAR_RAIN_WARNING;

    let fVis = createFactor('VISIBILITY', t('activities.good'), 'SAFE', t('activities.visibility'), '', 0);
    if (code === 48) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'CRITICAL', t('activities.visibility'), t('routes.noVisibility'), 100); criticals.push(t('routes.noVisibility')); }
    else if (code === 45) { fVis = createFactor('VISIBILITY', t('weather.fog'), 'WARNING', t('activities.visibility'), t('routes.denseFog'), 70); warnings.push(t('routes.denseFog')); }
    else if (rainMM > 10) { fVis = createFactor('VISIBILITY', t('routes.poor'), 'CRITICAL', t('activities.visibility'), t('routes.noVisibility'), 90); criticals.push(t('routes.noVisibility')); }

    const factorsCar = roadShowsRainMmCar ? [fTemp, fWind, fRoad, fVis] : [fTemp, fWind, fRoad, fPrecipCar, fVis];
    return { criticals, warnings, factors: factorsCar };
}

/**
 * Evaluador Pie — Rutas.
 */
export function evaluateWalk(data, t) {
    const d = normalizeData(data);
    const { temp, rainMM, snowCM, windSpeed, isFloorWet, humidity, usAqi } = d;
    const isSnow = snowCM > 0;
    const iceGround = temp < 0 && (rainMM > 0 || isFloorWet);
    let criticals = []; let warnings = [];

    let fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'SAFE', t('common.temp'), '', 0);
    if (temp > L.WALK_HEAT_CRITICAL) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'CRITICAL', t('common.temp'), t('activities.heatStrokeRisk'), 95); criticals.push(t('activities.heatStrokeRisk')); }
    else if (temp < -5) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'CRITICAL', t('common.temp'), t('activities.dangerCold'), 90); criticals.push(t('activities.dangerCold')); }
    else if (temp < 5) { fTemp = createFactor('TEMP', `${Math.round(temp)}°`, 'WARNING', t('common.temp'), t('activities.intenseCold'), 50); warnings.push(t('activities.intenseCold')); }

    const pName = isSnow ? t('weather.snow') : t('activities.rain');
    const pVal = isSnow ? `${snowCM}cm` : `${rainMM}mm`;
    let fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'SAFE', pName, '', 0);
    if (rainMM > L.WALK_RAIN_CRITICAL || isSnow) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'CRITICAL', pName, isSnow ? t('rain.heavySnow') : t('weather.rainHeavy'), 85); criticals.push(isSnow ? t('rain.heavySnow') : t('weather.rainHeavy')); }
    else if (rainMM > L.WALK_RAIN_WARNING) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'WARNING', pName, t('activities.rain'), 55); warnings.push(t('activities.rain')); }
    else if (rainMM > 0) { fPrecip = createFactor(isSnow ? 'SNOW' : 'PRECIP', pVal, 'WARNING', pName, t('weather.drizzle'), 30); warnings.push(t('weather.drizzle')); }

    let fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'SAFE', t('activities.wind'), '', 0);
    if (windSpeed > L.WALK_WIND_CRITICAL) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'CRITICAL', t('activities.wind'), t('activities.strongWind'), 85); criticals.push(t('activities.strongWind')); }
    else if (windSpeed > L.WALK_WIND_WARNING) { fWind = createFactor('WIND', `${Math.round(windSpeed)} km/h`, 'WARNING', t('activities.wind'), t('activities.annoyingWind'), 50); warnings.push(t('activities.annoyingWind')); }

    let fSoil = createFactor('GROUND', isFloorWet ? t('activities.wet') : t('activities.dry'), 'SAFE', t('activities.ground'), '', 0);
    if (iceGround) { fSoil = createFactor('GROUND', t('activities.iceRisk'), 'CRITICAL', t('activities.ground'), t('activities.iceOnGround'), 100); criticals.push(t('activities.iceOnGround')); }
    else if (isFloorWet) { fSoil = createFactor('GROUND', t('activities.wet'), 'WARNING', t('activities.ground'), t('activities.wetGround'), 40); warnings.push(t('activities.wetGround')); }

    const factors = [fTemp, fPrecip, fWind, fSoil];

    if (humidity != null && temp > 20) {
        const humStatus = humidity > L.HUMIDITY_CRITICAL ? 'CRITICAL' : humidity > L.HUMIDITY_WARNING ? 'WARNING' : 'SAFE';
        if (humStatus === 'CRITICAL') criticals.push(t('activities.highHumidity'));
        else if (humStatus === 'WARNING') warnings.push(t('activities.highHumidity'));
        factors.push(createFactor('HUMIDITY', `${Math.round(humidity)}%`, humStatus, t('activities.humidity'), humStatus !== 'SAFE' ? t('activities.highHumidity') : '', humStatus === 'CRITICAL' ? 70 : 40));
    }
    if (usAqi != null) {
        const aqiStatus = usAqi > L.AQI_CRITICAL ? 'CRITICAL' : 'SAFE';
        if (aqiStatus === 'CRITICAL') criticals.push(t('activities.poorAirQuality'));
        factors.push(createFactor('AQI', String(usAqi), aqiStatus, 'AQI', aqiStatus === 'CRITICAL' ? t('activities.poorAirQuality') : '', aqiStatus === 'CRITICAL' ? 75 : 0));
    }

    return { criticals, warnings, factors };
}
