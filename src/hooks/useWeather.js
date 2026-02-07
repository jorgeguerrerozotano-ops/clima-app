import { useState, useRef } from 'react';
import i18n from '../i18n';
import { getMoonPhase, sanitizeCode, getWeatherInfo, getRainText, getPrecipTypeLabel, interpolateHourlyValue, getIndexOfCurrentTime, interpolatePrecipTransitionTime, formatTimeRoundingToQuarterHour } from '../utils/helpers'; 

export { getWeatherInfo }; 

/** Umbral de precisión vertical GPS (m): solo usar altitud si accuracy < 100 */
const ALTITUDE_ACCURACY_THRESHOLD = 100;
/** Umbral de diferencia (m): solo incluir nueva altitud si difiere > 50m de la última usada */
const ALTITUDE_DEBOUNCE_THRESHOLD = 50;

export const useWeather = () => {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const lastFetchedAltRef = useRef(null);

    const fetchAPI = async (lat, lon, options = {}) => {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth,cloud_cover',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
            hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,is_day,cloud_cover,wind_speed_10m,precipitation,snowfall,snow_depth,relative_humidity_2m',
            timezone: 'auto',
        });
        if (typeof options.elevation === 'number') {
            params.set('elevation', String(Math.round(options.elevation)));
        }
        const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.reason || `Error ${res.status}`);
        if (data?.error) throw new Error(data.reason || 'Servicio no disponible');
        if (!data?.hourly?.time || !data?.daily || !data?.current) throw new Error('Datos incompletos');
        return data;
    };

    /** Air Quality API: misma ubicación. Si falla, no bloquea; la regla Running > AQI 150 se ignora (us_aqi null). */
    const fetchAirQuality = async (lat, lon) => {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto`;
        const res = await fetch(url);
        const aq = await res.json();
        if (!res.ok || aq?.error || !aq?.hourly?.time?.length) return null;
        return aq;
    };

    /** Combina hourly.us_aqi con weatherData.hourly por timestamp. Si aqData es null, devuelve data sin modificar. */
    const mergeAirQualityIntoHourly = (data, aqData) => {
        if (!aqData?.hourly?.us_aqi || !data?.hourly?.time?.length) return data;
        const aqByTime = new Map();
        (aqData.hourly.time || []).forEach((t, i) => { aqByTime.set(t, aqData.hourly.us_aqi[i]); });
        const us_aqi = data.hourly.time.map(t => aqByTime.get(t) ?? null);
        return { ...data, hourly: { ...data.hourly, us_aqi } };
    };

    const processWeatherData = (data, locationName, country, lat, lon) => {
        if (!data?.hourly?.time?.length || !data?.daily?.sunrise?.length) throw new Error('Estructura de datos inválida');
        const currentHourIndex = getIndexOfCurrentTime(data.hourly.time, data.timezone);

        // Índice base (si no encontramos hora, fallback a 0)
        const startIndex = currentHourIndex !== -1 ? currentHourIndex : 0;

        // Datos actuales base
        const currentPrecipMM = currentHourIndex !== -1 ? data.hourly.precipitation[currentHourIndex] : data.current.precipitation;
        const currentProb = currentHourIndex !== -1 ? data.hourly.precipitation_probability[currentHourIndex] : 0;
        // Interpolación lineal de probabilidad de precipitación para "ahora" (igual que temperatura)
        const interpolatedProb = interpolateHourlyValue(
            data.hourly.precipitation_probability,
            data.hourly.time,
            new Date(),
            data.timezone
        );
        const probForNow = interpolatedProb != null ? Math.round(interpolatedProb) : currentProb;

        let baseCode = currentHourIndex !== -1 ? data.hourly.weather_code[currentHourIndex] : data.current.weather_code;
        // --- SANITIZACIÓN CENTRALIZADA ---
        baseCode = sanitizeCode(baseCode, currentPrecipMM, probForNow);

        const baseTemp = currentHourIndex !== -1 ? data.hourly.temperature_2m[currentHourIndex] : data.current.temperature_2m;
        const baseFeelsLike = currentHourIndex !== -1 ? data.hourly.apparent_temperature[currentHourIndex] : data.current.apparent_temperature;
        const baseIsDay = currentHourIndex !== -1 ? data.hourly.is_day[currentHourIndex] : data.current.is_day;
        const currentSnowCM = currentHourIndex !== -1 ? data.hourly.snowfall[currentHourIndex] : data.current.snowfall;
        const currentSnowDepth = currentHourIndex !== -1 ? data.hourly.snow_depth[currentHourIndex] : data.current.snow_depth;

        // Arrays Futuros
        const futureProb = data.hourly.precipitation_probability.slice(startIndex);
        const futureTime = data.hourly.time.slice(startIndex);
        const futureCloud = data.hourly.cloud_cover.slice(startIndex);
        const futureTemp = data.hourly.temperature_2m.slice(startIndex);
        let futureCodes = data.hourly.weather_code.slice(startIndex); // Let para modificarlo
        const futureIsDay = data.hourly.is_day.slice(startIndex);
        const futurePrecip = data.hourly.precipitation.slice(startIndex);
        
        const futureSnow = data.hourly.snowfall.slice(startIndex);
        const futureSnowDepth = data.hourly.snow_depth.slice(startIndex);

        // --- SANITIZACIÓN DE PREVISIÓN ---
        // Limpiamos todo el array futuro usando probabilidad + milímetros
        futureCodes = futureCodes.map((c, i) => sanitizeCode(c, futurePrecip[i], futureProb[i]));

        // Lógica de texto
        let nextRainText = i18n.t('weather.noPrecip');
        let isRainingNow = currentPrecipMM >= 0.15;
        let isSnowingNow = currentSnowCM > 0; 

        if (!isRainingNow && !isSnowingNow && baseTemp <= -5) {
            nextRainText = i18n.t('weather.arctic');
        } else if (isRainingNow || isSnowingNow) {
            const stopIndex = futurePrecip.findIndex(mm => mm < 0.15); 
            const typeText = isSnowingNow ? i18n.t('weather.snow') : i18n.t('activities.rain');
            if (stopIndex === -1) nextRainText = `${typeText} ${i18n.t('weather.continues')}`;
            else {
                const stopDate = new Date(futureTime[stopIndex]);
                nextRainText = `${i18n.t('weather.stopsAt')} ${stopDate.toLocaleTimeString(i18n.language,{hour:'2-digit',minute:'2-digit'})}`;
            }
        } else {
            // Buscamos próxima lluvia significativa (Prob >= 30%)
            const rainIndex = futurePrecip.findIndex((mm, idx) => mm >= 0.25 && futureProb[idx] >= 30);
            
            if (rainIndex !== -1) {
                const rainDate = new Date(futureTime[rainIndex]);
                const today = new Date();
                const isToday = rainDate.getDate() === today.getDate();
                const prefix = isToday ? i18n.t('weather.atTime') : i18n.t('weather.tomorrowAt');
                const isNextSnow = futureSnow[rainIndex] > 0;
                const intensityText = getRainText(futureProb[rainIndex], futurePrecip[rainIndex], isNextSnow, futureTemp[rainIndex]);
                nextRainText = `${intensityText} ${prefix} ${rainDate.toLocaleTimeString(i18n.language,{hour:'2-digit',minute:'2-digit'})}`;
            }
        }

        const next12hClouds = futureCloud.slice(0, 12);
        const avgClouds = next12hClouds.reduce((a,b)=>a+b,0) / next12hClouds.length;
        const laundrySafe = futurePrecip.slice(0, 12).every(mm => mm < 0.2);

        // --- Alerta de Precipitación Inminente (próximas 8h, mismo umbral 0.15mm que el resto de la app) ---
        const PRECIP_THRESHOLD_MM = 0.15;
        const WINDOW_HOURS = 8;
        const windowPrecip = futurePrecip.slice(0, WINDOW_HOURS);
        const windowSnow = futureSnow.slice(0, WINDOW_HOURS);
        const windowTime = futureTime.slice(0, WINDOW_HOURS);
        const hasPrecip = (i) => (windowPrecip[i] >= PRECIP_THRESHOLD_MM || windowSnow[i] > 0);

        let precipitationAlert = null;
        const precipitatingNow = hasPrecip(0);
        if (precipitatingNow) {
            // Caso A: ya llueve/nieva → buscar primera hora en que para; interpolar instante y redondear a cuartos de hora
            const stopIdx = windowTime.findIndex((_, i) => i > 0 && !hasPrecip(i));
            if (stopIdx !== -1) {
                const t0 = windowTime[stopIdx - 1];
                const t1 = windowTime[stopIdx];
                const p0 = windowPrecip[stopIdx - 1];
                const p1 = windowPrecip[stopIdx];
                const interpolated = interpolatePrecipTransitionTime(t0, t1, p0, p1, PRECIP_THRESHOLD_MM);
                const hourLabel = formatTimeRoundingToQuarterHour(interpolated, data.timezone);
                const isSnow = currentSnowCM > 0;
                const precipTypeLabel = getPrecipTypeLabel(currentPrecipMM, currentSnowCM);
                precipitationAlert = { type: 'stop', hourLabel, relativeLabel: null, isSnow, precipTypeLabel, isApprox: true };
            }
        } else {
            // Caso B: no llueve ahora → buscar primera hora en que empieza; interpolar y redondear a cuartos de hora
            const startIdx = windowTime.findIndex((_, i) => hasPrecip(i));
            if (startIdx !== -1) {
                let interpolated;
                if (startIdx > 0) {
                    const t0 = windowTime[startIdx - 1];
                    const t1 = windowTime[startIdx];
                    const p0 = windowPrecip[startIdx - 1];
                    const p1 = windowPrecip[startIdx];
                    interpolated = interpolatePrecipTransitionTime(t0, t1, p0, p1, PRECIP_THRESHOLD_MM);
                } else {
                    interpolated = new Date(windowTime[0]);
                }
                const hourLabel = formatTimeRoundingToQuarterHour(interpolated, data.timezone);
                const now = Date.now();
                const diffMin = Math.round((interpolated - now) / 60000);
                const relativeLabel = diffMin < 60 ? i18n.t('weather.inMinutes', { count: Math.max(0, diffMin) }) : i18n.t('weather.inHours', { count: Math.round(diffMin / 60) });
                const isSnow = windowSnow[startIdx] > 0;
                const precipTypeLabel = getPrecipTypeLabel(windowPrecip[startIdx], windowSnow[startIdx]);
                precipitationAlert = { type: 'start', hourLabel, relativeLabel, isSnow, precipTypeLabel, isApprox: true };
            }
        }

        const hourlyForecast = futureTime.slice(0, 24).map((time, i) => ({
            time: new Date(time).toLocaleTimeString(i18n.language, {hour: '2-digit', minute: '2-digit'}),
            temp: Math.round(futureTemp[i]), 
            iconCode: futureCodes[i], // Este código YA viene limpio
            isDay: futureIsDay[i], 
            prob: futureProb[i],
            mm: futurePrecip[i],
            snowCM: futureSnow[i],
            snowDepth: futureSnowDepth[i] 
        }));

        const sunrise = new Date(data.daily.sunrise[0]).toLocaleTimeString(i18n.language, {hour:'2-digit', minute:'2-digit'});
        const sunset = new Date(data.daily.sunset[0]).toLocaleTimeString(i18n.language, {hour:'2-digit', minute:'2-digit'});
        const moonPhase = getMoonPhase(new Date());

        return {
            location: { name: locationName, country, lat, lon },
            timezone: data.timezone,
            current: { 
                temp: Math.round(baseTemp),
                feelsLike: Math.round(baseFeelsLike),
                humidity: data.current.relative_humidity_2m, 
                code: baseCode,
                isDay: baseIsDay,
                wind_speed: data.current.wind_speed_10m,
                cloud_cover: data.current.cloud_cover,
                precip: currentPrecipMM,
                snow: currentSnowCM,
                snowDepth: currentSnowDepth,
                precipProbability: probForNow
            },
            astro: { sunrise, sunset, moonPhase },
            daily: data.daily,
            analysis: {
                nextRainText, isRainingNow,
                laundrySafe, avgClouds, hourlyForecast,
                precipitationAlert
            },
            rawHourly: data.hourly
        };
    };

    /**
     * Resuelve si debemos incluir elevation en la petición.
     * 1. altitudeAccuracy < 100 (fiabilidad GPS)
     * 2. Math.round(altitude)
     * 3. Debounce: solo si |currentAlt - lastFetchedAlt| > 50m (evita ruido del sensor)
     */
    const resolveElevation = (altitude, altitudeAccuracy) => {
        if (typeof altitude !== 'number' || Number.isNaN(altitude)) return undefined;
        if (altitudeAccuracy == null || altitudeAccuracy >= ALTITUDE_ACCURACY_THRESHOLD) return undefined;
        const roundedAlt = Math.round(altitude);
        const last = lastFetchedAltRef.current;
        if (last !== null && Math.abs(roundedAlt - last) <= ALTITUDE_DEBOUNCE_THRESHOLD) {
            return last;
        }
        lastFetchedAltRef.current = roundedAlt;
        return roundedAlt;
    };

    const loadWeatherData = async (lat, lon, name, isGPS = false, gpsCoords = null) => {
        setLoading(true);
        setError(null);
        try {
            let elevation;
            if (isGPS && gpsCoords) {
                elevation = resolveElevation(gpsCoords.altitude, gpsCoords.altitudeAccuracy);
            }
            const [data, aqData] = await Promise.all([
                fetchAPI(lat, lon, elevation !== undefined ? { elevation } : {}),
                fetchAirQuality(lat, lon).catch(() => null)
            ]);
            const dataWithAqi = mergeAirQualityIntoHourly(data, aqData);
            const processed = processWeatherData(dataWithAqi, name, isGPS ? "GPS" : data.timezone, lat, lon);
            setWeatherData(processed);
        } catch (e) {
            console.error(e);
            setError(i18n.t('errors.loadingData'));
        } finally {
            setLoading(false);
        }
    };

    return { weatherData, loading, error, loadWeatherData };
};