import { useState } from 'react';
import { getRouteData, sanitizeCode, getWeatherInfo } from '../utils/helpers';
import { 
    Thermometer, Wind, CloudRain, CloudFog, Mountain, Footprints 
} from 'lucide-react';

// --- HELPER: Petición a la API ---
const fetchRawAPI = async (lat, lon) => {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,precipitation,snowfall,snow_depth&timezone=auto`);
    return await res.json();
};

// --- HELPER: Extraer pronóstico (Snapshot + Contexto) ---
const getForecastAtTime = (hourlyData, targetDateObj) => {
    if (!hourlyData || !hourlyData.time) return null;
    const targetTime = targetDateObj.getTime();
    
    let closestIndex = -1, minDiff = Infinity;
    
    hourlyData.time.forEach((t, i) => {
        const time = new Date(t).getTime();
        const diff = Math.abs(time - targetTime);
        if (diff < minDiff) { minDiff = diff; closestIndex = i; }
    });

    if (closestIndex === -1) return null;

    // Calcular Suelo Mojado (Suma de precipitación de las 2 horas previas)
    let isFloorWet = false;
    if (closestIndex >= 2) {
        const rainSum = hourlyData.precipitation.slice(closestIndex - 2, closestIndex).reduce((a, b) => a + b, 0);
        isFloorWet = rainSum > 0.5;
    }

    return {
        temp: hourlyData.temperature_2m[closestIndex],
        rainProb: hourlyData.precipitation_probability[closestIndex],
        rainMM: hourlyData.precipitation[closestIndex],
        snowCM: hourlyData.snowfall ? hourlyData.snowfall[closestIndex] : 0,
        snowDepth: hourlyData.snow_depth ? hourlyData.snow_depth[closestIndex] : 0,
        windSpeed: hourlyData.wind_speed_10m[closestIndex],
        code: sanitizeCode(hourlyData.weather_code[closestIndex], hourlyData.precipitation[closestIndex]), 
        isFloorWet,
        time: new Date(hourlyData.time[closestIndex]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    };
};

// ==========================================
// 1. EVALUADOR MOTO / BICI (Vulnerables a la vía)
// ==========================================
const evaluateMotoLike = (data) => {
    const { temp, rainMM, snowCM, snowDepth, windSpeed, isFloorWet, code } = data;
    const isSnow = snowCM > 0;
    
    let criticals = []; let warnings = [];

    // TEMP
    let fTemp = { name: 'Temp', value: `${Math.round(temp)}°`, status: 'green', icon: Thermometer };
    if (temp < 2) { fTemp.status = 'red'; criticals.push('Riesgo Hielo'); }
    else if (temp < 6) { fTemp.status = 'yellow'; warnings.push('Frío intenso'); }

    // VIENTO
    let fWind = { name: 'Viento', value: `${Math.round(windSpeed)} km/h`, status: 'green', icon: Wind };
    if (windSpeed > 50) { fWind.status = 'red'; criticals.push('Viento peligroso'); }
    else if (windSpeed > 30) { fWind.status = 'yellow'; warnings.push('Viento molesto'); }

    // CALZADA
    let fRoad = { name: 'Calzada', value: 'Seca', status: 'green', icon: CloudRain };
    if (snowDepth > 0) {
        fRoad.name = 'Nieve'; fRoad.value = `${Math.round(snowDepth*100)}cm`; fRoad.icon = Mountain;
        fRoad.status = 'red'; criticals.push('Nieve en vía');
    } else if (rainMM > 0.2 || isSnow) {
        fRoad.name = isSnow ? 'Nevando' : 'Lloviendo'; 
        fRoad.value = isSnow ? `${snowCM}cm` : `${rainMM}mm`;
        fRoad.status = 'red'; criticals.push('Precipitación activa');
    } else if (isFloorWet) {
        fRoad.value = 'Húmeda'; fRoad.status = 'yellow'; warnings.push('Asfalto húmedo');
    }

    // VISIBILIDAD
    let fVis = { name: 'Visib.', value: 'Buena', status: 'green', icon: CloudFog };
    if (code === 45 || code === 48) {
        fVis.value = 'Niebla'; fVis.status = 'yellow'; warnings.push('Visibilidad reducida');
    } else if (rainMM > 2.0 || isSnow) {
        fVis.value = 'Regular'; fVis.status = 'yellow';
    }

    return { criticals, warnings, factors: [fTemp, fWind, fRoad, fVis] };
};

// ==========================================
// 2. EVALUADOR COCHE (Protegidos)
// ==========================================
const evaluateCar = (data) => {
    const { temp, rainMM, snowCM, snowDepth, windSpeed, code } = data;
    const isSnow = snowCM > 0;

    let criticals = []; let warnings = [];

    // TEMP: Solo importa el hielo. Confort da igual.
    let fTemp = { name: 'Temp', value: `${Math.round(temp)}°`, status: 'green', icon: Thermometer };
    if (temp < -5) { fTemp.status = 'red'; criticals.push('Hielo severo'); }
    else if (temp < 0) { fTemp.status = 'yellow'; warnings.push('Posible hielo'); }

    // VIENTO: Muy estable.
    let fWind = { name: 'Viento', value: `${Math.round(windSpeed)} km/h`, status: 'green', icon: Wind };
    if (windSpeed > 90) { fWind.status = 'red'; criticals.push('Viento huracanado'); }
    else if (windSpeed > 60) { fWind.status = 'yellow'; warnings.push('Viento fuerte'); }

    // CALZADA / LLUVIA: Solo diluvio es rojo.
    let fRoad = { name: 'Lluvia', value: 'Seco', status: 'green', icon: CloudRain };
    
    if (snowDepth > 0) {
        fRoad.name = 'Nieve'; fRoad.value = `${Math.round(snowDepth*100)}cm`; fRoad.icon = Mountain;
        fRoad.status = 'red'; criticals.push('Carretera nevada');
    } else if (isSnow) {
        fRoad.name = 'Nieve'; fRoad.value = `${snowCM}cm`;
        fRoad.status = 'red'; criticals.push('Nevando');
    } else if (rainMM > 5.0) { // DILUVIO
        fRoad.value = `${rainMM}mm`;
        fRoad.status = 'red'; criticals.push('Lluvia torrencial');
    } else if (rainMM > 0.5) {
        fRoad.value = `${rainMM}mm`;
        fRoad.status = 'yellow'; // Amarillo informativo, no crítico
        warnings.push('Lluvia en ruta');
    } else if (rainMM > 0) {
        fRoad.value = 'Llovizna'; // Verde
    }

    // VISIBILIDAD
    let fVis = { name: 'Visib.', value: 'Buena', status: 'green', icon: CloudFog };
    if (code === 45 || code === 48) {
        fVis.value = 'Niebla'; fVis.status = 'yellow'; warnings.push('Niebla densa');
    } else if (rainMM > 10) { 
        fVis.value = 'Mala'; fVis.status = 'red'; criticals.push('Visibilidad nula');
    }

    return { criticals, warnings, factors: [fTemp, fWind, fRoad, fVis] };
};

// ==========================================
// 3. EVALUADOR CAMINAR (Vulnerables al clima)
// ==========================================
const evaluateWalk = (data) => {
    const { temp, rainMM, snowCM, windSpeed, isFloorWet } = data;
    const isSnow = snowCM > 0;
    
    let criticals = []; let warnings = [];

    // TEMP (Igual que Running)
    let fTemp = { name: 'Temp', value: `${Math.round(temp)}°`, status: 'green', icon: Thermometer };
    if (temp < -5) { fTemp.status = 'red'; criticals.push('Peligro Frío'); }
    else if (temp < 5) { fTemp.status = 'yellow'; warnings.push('Frío intenso'); }
    else if (temp > 35) { fTemp.status = 'red'; criticals.push('Calor extremo'); }
    else if (temp > 30) { fTemp.status = 'yellow'; warnings.push('Calor'); }

    // PRECIPITACIÓN
    let fPrecip = { name: isSnow?'Nieve':'Lluvia', value: isSnow?`${snowCM}cm`:`${rainMM}mm`, status: 'green', icon: CloudRain };
    if (rainMM > 2.0 || isSnow) { fPrecip.status = 'red'; criticals.push(isSnow ? 'Nevada' : 'Lluvia fuerte'); }
    else if (rainMM > 0.5) { fPrecip.status = 'yellow'; warnings.push('Lluvia'); }
    else if (rainMM > 0) { fPrecip.status = 'yellow'; warnings.push('Llovizna'); } // Caminar lloviendo molesta

    // VIENTO
    let fWind = { name: 'Viento', value: `${Math.round(windSpeed)} km/h`, status: 'green', icon: Wind };
    if (windSpeed > 50) { fWind.status = 'red'; criticals.push('Viento fuerte'); }
    else if (windSpeed > 30) { fWind.status = 'yellow'; warnings.push('Viento molesto'); }

    // SUELO
    let fSoil = { name: 'Suelo', value: isFloorWet?'Mojado':'Seco', status: 'green', icon: Footprints };
    if (isFloorWet) { fSoil.status = 'yellow'; warnings.push('Suelo mojado'); }

    return { criticals, warnings, factors: [fTemp, fPrecip, fWind, fSoil] };
};

// --- ROUTER LÓGICO ---
const evaluateSegment = (data, mode) => {
    if (!data) return { status: 'gray', message: 'Sin datos', factors: [] };

    let result;
    
    // SELECCIÓN DE LÓGICA
    if (mode === 'car') {
        result = evaluateCar(data);
    } else if (mode === 'walk') {
        result = evaluateWalk(data);
    } else {
        // Moto y Bici comparten lógica
        result = evaluateMotoLike(data);
    }

    const { criticals, warnings, factors } = result;

    // GENERAR MENSAJE FINAL
    let status = 'green';
    let message = 'Condiciones Ideales';
    
    if (criticals.length > 0) {
        status = 'red';
        message = `${criticals.length} ALERTAS CRÍTICAS`;
    } else if (warnings.length > 0) {
        status = 'yellow';
        message = `${warnings.length} Advertencias`;
    }

    // Estilos de tarjeta UI
    let colorClass = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300';
    if (status === 'yellow') colorClass = 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300';
    if (status === 'red') colorClass = 'bg-red-500/10 border-red-500/50 text-red-300';

    return { 
        status, 
        message,
        colorClass, 
        factors 
    };
};

// === HOOK PRINCIPAL ===
export const useRouteWeather = () => {
    const [loading, setLoading] = useState(false);
    const [routeResult, setRouteResult] = useState(null);
    const [error, setError] = useState(null);

    const resetRoute = () => {
        setRouteResult(null);
        setError(null);
    };

    const calculateRoute = async (origin, dest, mode, departureDateObj) => {
        if (!origin || !dest) return;
        
        setLoading(true);
        setError(null);
        setRouteResult(null);

        try {
            const lat1 = parseFloat(origin.lat), lon1 = parseFloat(origin.lon);
            const lat2 = parseFloat(dest.lat), lon2 = parseFloat(dest.lon);
            
            // 1. Ruta física
            const routeData = await getRouteData(lat1, lon1, lat2, lon2, mode);
            const durationMinutes = routeData.durationMin || 30; 
            const distKm = parseFloat(routeData.distanceKm) || 10;
            
            // 2. Tiempos
            const depDate = departureDateObj;
            const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);
            const midDate = new Date(depDate.getTime() + (durationMinutes/2) * 60000);

            // 3. Clima
            const [originRaw, destRaw, midRaw] = await Promise.all([
                fetchRawAPI(lat1, lon1), 
                fetchRawAPI(lat2, lon2), 
                fetchRawAPI((lat1+lat2)/2, (lon1+lon2)/2)
            ]);

            const originF = getForecastAtTime(originRaw.hourly, depDate);
            const midF = getForecastAtTime(midRaw.hourly, midDate);
            const destF = getForecastAtTime(destRaw.hourly, arrDate);
            
            const destInfo = getWeatherInfo(destF?.code || 0);

            // 4. Construir Resultado (Pasando 'mode' al evaluador)
            const info = {
                dist: Math.round(distKm),
                time: Math.floor(durationMinutes/60) > 0 ? `${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m` : `${durationMinutes}m`,
                destWeather: { 
                    temp: destF ? Math.round(destF.temp)+'°' : '--', 
                    text: destInfo.label, 
                    arrival: arrDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) 
                },
                originWeather: { 
                    temp: originF ? Math.round(originF.temp) + '°' : '--', 
                },
                segments: {
                    origin: { ...evaluateSegment(originF, mode), time: depDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), name: "Salida" },
                    mid: { ...evaluateSegment(midF, mode), time: midDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), name: "En ruta" },
                    dest: { ...evaluateSegment(destF, mode), time: arrDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), name: "Llegada" }
                }
            };

            setRouteResult(info);
        } catch (e) {
            console.error(e);
            setError("No se pudo calcular la ruta. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return { 
        calculateRoute, 
        routeResult, 
        loading, 
        error, 
        resetRoute 
    };
};