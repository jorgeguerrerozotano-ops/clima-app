import { useState, useEffect } from 'react';
import { interpolateHourlyValue } from '../utils/helpers';

/**
 * Hook que calcula temperatura y sensación térmica interpoladas (LERP) en vivo.
 * Se recalcula cada minuto para suavizar la transición entre horas.
 * Solo interpola magnitudes continuas (temp, feelsLike). Los datos categóricos
 * (weather_code, precipitation, etc.) NO se interpolan.
 *
 * @param {Object|null} weatherData - Datos del clima (debe tener rawHourly y current)
 * @returns {{ temp: number, feelsLike: number }} Valores interpolados o fallback a current
 */
export function useInterpolatedTemperature(weatherData) {
    const [interpolated, setInterpolated] = useState({ temp: null, feelsLike: null });

    useEffect(() => {
        if (!weatherData?.rawHourly) {
            setInterpolated({
                temp: weatherData?.current?.temp ?? null,
                feelsLike: weatherData?.current?.feelsLike ?? null,
            });
            return;
        }

        const compute = () => {
            const raw = weatherData.rawHourly;
            const tz = weatherData.timezone;
            const now = new Date();

            const temp = interpolateHourlyValue(
                raw.temperature_2m,
                raw.time,
                now,
                tz
            );
            const feelsLike = interpolateHourlyValue(
                raw.apparent_temperature,
                raw.time,
                now,
                tz
            );

            setInterpolated({
                temp: temp != null ? Math.round(temp * 10) / 10 : weatherData.current?.temp ?? null,
                feelsLike: feelsLike != null ? Math.round(feelsLike * 10) / 10 : weatherData.current?.feelsLike ?? null,
            });
        };

        compute();
        const interval = setInterval(compute, 60000);
        return () => clearInterval(interval);
    }, [weatherData]);

    return {
        temp: interpolated.temp ?? weatherData?.current?.temp ?? null,
        feelsLike: interpolated.feelsLike ?? weatherData?.current?.feelsLike ?? null,
    };
}
