import { useState, useRef } from 'react';
import i18n from '../i18n';
import { getWeatherInfo } from '../utils/weatherUtils';
import { processWeatherData } from '../utils/weatherParser';
import { fetchOpenMeteoForecast, fetchAirQuality, mergeAirQualityIntoHourly } from '../utils/weatherApi';

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
    /** Última petición iniciada: solo aplicamos estado si la respuesta corresponde a esta petición (evita race conditions). */
    const lastRequestIdRef = useRef(0);

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
        const myRequestId = ++lastRequestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            let elevation;
            if (isGPS && gpsCoords) {
                elevation = resolveElevation(gpsCoords.altitude, gpsCoords.altitudeAccuracy);
            }
            const [data, aqData] = await Promise.all([
                fetchOpenMeteoForecast(lat, lon, elevation !== undefined ? { elevation } : {}),
                fetchAirQuality(lat, lon).catch(() => null)
            ]);
            if (myRequestId !== lastRequestIdRef.current) return;
            const dataWithAqi = mergeAirQualityIntoHourly(data, aqData);
            const processed = processWeatherData(dataWithAqi, name, isGPS ? "GPS" : data.timezone, lat, lon);
            if (myRequestId !== lastRequestIdRef.current) return;
            setWeatherData(processed);
        } catch (e) {
            if (myRequestId !== lastRequestIdRef.current) return;
            console.error(e);
            setError(i18n.t('errors.loadingData'));
        } finally {
            if (myRequestId === lastRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    return { weatherData, loading, error, loadWeatherData };
};