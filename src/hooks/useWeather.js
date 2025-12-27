import { useState } from 'react';
import { getMoonPhase, sanitizeCode, getWeatherInfo, getRainText } from '../utils/helpers'; 

export { getWeatherInfo }; 

export const useWeather = () => {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAPI = async (lat, lon) => {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth,cloud_cover&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,is_day,cloud_cover,wind_speed_10m,precipitation,snowfall,snow_depth,relative_humidity_2m&timezone=auto`);
        return await res.json();
    };

    const processWeatherData = (data, locationName, country, lat, lon) => {
        const currentHourObj = new Date();
        const currentHourIndex = data.hourly.time.findIndex(t => {
            const d = new Date(t);
            return d.getDate() === currentHourObj.getDate() && 
                   d.getHours() === currentHourObj.getHours();
        });

        // Índice base (si no encontramos hora, fallback a 0)
        const startIndex = currentHourIndex !== -1 ? currentHourIndex : 0;

        // Datos actuales base
        const currentPrecipMM = currentHourIndex !== -1 ? data.hourly.precipitation[currentHourIndex] : data.current.precipitation;
        // IMPORTANTE: Obtenemos la probabilidad actual del array hourly
        const currentProb = currentHourIndex !== -1 ? data.hourly.precipitation_probability[currentHourIndex] : 0;
        
        let baseCode = currentHourIndex !== -1 ? data.hourly.weather_code[currentHourIndex] : data.current.weather_code;
        
        // --- SANITIZACIÓN CENTRALIZADA ---
        // Pasamos Probability a sanitizeCode para corregir el "falso positivo"
        baseCode = sanitizeCode(baseCode, currentPrecipMM, currentProb);

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
        let nextRainText = "Sin precipitaciones";
        let isRainingNow = currentPrecipMM >= 0.15;
        let isSnowingNow = currentSnowCM > 0; 

        if (!isRainingNow && !isSnowingNow && baseTemp <= -5) {
            nextRainText = "Ambiente Gélido";
        } else if (isRainingNow || isSnowingNow) {
            const stopIndex = futurePrecip.findIndex(mm => mm < 0.15); 
            const typeText = isSnowingNow ? "La nieve" : "La lluvia";
            if (stopIndex === -1) nextRainText = `${typeText} continúa`;
            else {
                const stopDate = new Date(futureTime[stopIndex]);
                nextRainText = `Para a las ${stopDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
            }
        } else {
            // Buscamos próxima lluvia significativa (Prob >= 30%)
            const rainIndex = futurePrecip.findIndex((mm, idx) => mm >= 0.25 && futureProb[idx] >= 30);
            
            if (rainIndex !== -1) {
                const rainDate = new Date(futureTime[rainIndex]);
                const today = new Date();
                const isToday = rainDate.getDate() === today.getDate();
                const prefix = isToday ? "a las" : "Mañana a las";
                const isNextSnow = futureSnow[rainIndex] > 0;
                const intensityText = getRainText(futureProb[rainIndex], futurePrecip[rainIndex], isNextSnow, futureTemp[rainIndex]);
                nextRainText = `${intensityText} ${prefix} ${rainDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
            }
        }

        const next12hClouds = futureCloud.slice(0, 12);
        const avgClouds = next12hClouds.reduce((a,b)=>a+b,0) / next12hClouds.length;
        const laundrySafe = futurePrecip.slice(0, 12).every(mm => mm < 0.2);

        const hourlyForecast = futureTime.slice(0, 24).map((time, i) => ({
            time: new Date(time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            temp: Math.round(futureTemp[i]), 
            iconCode: futureCodes[i], // Este código YA viene limpio
            isDay: futureIsDay[i], 
            prob: futureProb[i],
            mm: futurePrecip[i],
            snowCM: futureSnow[i],
            snowDepth: futureSnowDepth[i] 
        }));

        const sunrise = new Date(data.daily.sunrise[0]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const sunset = new Date(data.daily.sunset[0]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const moonPhase = getMoonPhase(new Date());

        return {
            location: { name: locationName, country, lat, lon },
            timezone: data.timezone,
            current: { 
                temp: Math.round(baseTemp),
                feelsLike: Math.round(baseFeelsLike),
                humidity: data.current.relative_humidity_2m, 
                code: baseCode, // Este código YA viene limpio
                isDay: baseIsDay,
                wind_speed: data.current.wind_speed_10m,
                cloud_cover: data.current.cloud_cover,
                precip: currentPrecipMM,
                snow: currentSnowCM,
                snowDepth: currentSnowDepth
            },
            astro: { sunrise, sunset, moonPhase },
            daily: data.daily,
            analysis: {
                nextRainText, isRainingNow,
                laundrySafe, avgClouds, hourlyForecast
            },
            rawHourly: data.hourly
        };
    };

    const loadWeatherData = async (lat, lon, name, isGPS=false) => {
        setLoading(true); 
        setError(null);
        try {
            const data = await fetchAPI(lat, lon);
            const processed = processWeatherData(data, name, isGPS ? "GPS" : data.timezone, lat, lon);
            setWeatherData(processed);
        } catch(e) { 
            console.error(e);
            setError("Error cargando datos."); 
        } finally { 
            setLoading(false); 
        }
    };

    return { weatherData, loading, error, loadWeatherData };
};