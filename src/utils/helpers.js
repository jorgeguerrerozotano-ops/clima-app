// src/utils/helpers.js

// --- DICCIONARIO CLIMÁTICO OFICIAL ---
export const getWeatherInfo = (code) => {
    if (code === 0) return { label: 'Despejado', color: 'text-yellow-400' };
    if (code >= 1 && code <= 3) return { label: 'Nublado', color: 'text-gray-300' };
    if (code >= 45 && code <= 48) return { label: 'Niebla', color: 'text-slate-400' };
    
    // Lloviznas
    if (code >= 51 && code <= 57) return { label: 'Llovizna', color: 'text-blue-300' };
    
    // Lluvia
    if (code === 61) return { label: 'Lluvia Débil', color: 'text-blue-300' };
    if (code === 63) return { label: 'Lluvia Moderada', color: 'text-blue-400' };
    if (code === 65) return { label: 'Lluvia Fuerte', color: 'text-blue-500' };
    if (code >= 66 && code <= 67) return { label: 'Lluvia Helada', color: 'text-cyan-200' };
    
    // Nieve
    if (code >= 71 && code <= 77) return { label: 'Nieve', color: 'text-cyan-100' };
    
    // Chubascos
    if (code === 80) return { label: 'Chubasco Débil', color: 'text-blue-300' };
    if (code === 81) return { label: 'Chubascos', color: 'text-blue-400' };
    if (code === 82) return { label: 'Chubasco Intenso', color: 'text-blue-500' };
    
    // Nieve chubascos
    if (code === 85 || code === 86) return { label: 'Nieve', color: 'text-cyan-100' };
    
    // Tormenta
    if (code >= 95) return { label: 'Tormenta', color: 'text-purple-400' };
    
    return { label: 'Desconocido', color: 'text-gray-400' };
};

// --- FUNCIÓN DE SANITIZACIÓN (CORE DE LA SOLUCIÓN) ---
export const sanitizeCode = (originalCode, precipMM, rainProb = 100) => {
    // 1. FILTRO ANTI-RUIDO (Probabilidad < 30%)
    if (rainProb < 30) {
        if (originalCode >= 51 && originalCode <= 67) return 3;
        if (originalCode >= 80 && originalCode <= 82) return 3;
    }

    // 2. FILTRO DE VOLUMEN (Si llueve 0.0mm es "Nublado")
    if (precipMM < 0.15) {
        if (originalCode > 48) {
             if (originalCode >= 95) return originalCode; 
             if ((originalCode >= 71 && originalCode <= 77) || (originalCode >= 85 && originalCode <= 86)) {
                return originalCode;
             }
             return 3; 
        }
        return originalCode; 
    }

    // 3. DEGRADACIÓN DE INTENSIDAD
    if (precipMM < 1.5) {
        if (originalCode === 65) return 63; 
        if (originalCode === 82) return 81; 
        if (originalCode === 81) return 80; 
    }
    
    return originalCode;
};

export const getMoonPhase = (date) => {
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
    if (phase < 0.05) return "Nueva";
    if (phase < 0.20) return "Creciente"; 
    if (phase < 0.30) return "C. Cuarto"; 
    if (phase < 0.45) return "Gibosa"; 
    if (phase < 0.55) return "Llena";
    if (phase < 0.70) return "Gibosa"; 
    if (phase < 0.80) return "M. Cuarto"; 
    if (phase < 0.95) return "Menguante"; 
    return "Nueva";
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
    
    let probText = "Nula";
    if (probValue > 0) probText = "Baja";
    if (probValue >= 30) probText = "Media";
    if (probValue >= 60) probText = "Alta";
    if (probValue >= 80) probText = "Muy Alta";

    return {
        avgMaxGlobal: (sumMax / chartData.length).toFixed(1),
        avgMinGlobal: (sumMin / chartData.length).toFixed(1),
        tempDelta: (recentAvgTemp - historicalAvgTemp).toFixed(1),
        rainDelta: (recentAvgRain - historicalAvgRain).toFixed(1),
        rainProbValue: Math.round(probValue),
        rainProbText: probText
    };
};

export const getRouteData = async (lat1, lon1, lat2, lon2, mode = 'moto') => {
    const profile = 'driving'; 
    const url = `https://router.project-osrm.org/route/v1/${profile}/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) throw new Error("Ruta no encontrada");
        const route = data.routes[0];
        const destSnapped = data.waypoints[1].location; 
        const discrepancy = getDistanceFromLatLonInKm(lat2, lon2, destSnapped[1], destSnapped[0]);
        if (discrepancy > 50) throw new Error(`Sin ruta terrestre. Distancia al punto más cercano: ${Math.round(discrepancy)}km.`);
        const distKm = (route.distance / 1000); 
        let finalDurationMin = 0;
        if (mode === 'walk') finalDurationMin = Math.round((distKm / 5) * 60);
        else if (mode === 'bicycle') finalDurationMin = Math.round((distKm / 20) * 60);
        else finalDurationMin = Math.round(route.duration / 60);
        return { distanceKm: distKm.toFixed(1), durationMin: finalDurationMin };
    } catch (error) { console.error("Error OSRM:", error); throw error; }
};

export const formatStandardLocation = (data) => {
    if (data.address) {
        const a = data.address;
        const parts = [];
        let zone = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || a.village || a.town || a.municipality;
        if (!zone) zone = a.city; if (!zone && data.name) zone = data.name; if (!zone) zone = "Ubicación";
        parts.push(zone);
        const city = a.city || a.town || a.municipality;
        const province = a.province || a.county; 
        if (city && city !== zone) parts.push(city);
        else if (province && province !== zone && province !== city) parts.push(province);
        if (a.country) parts.push(a.country);
        return parts.join(", ");
    }
    return data.name || "Ubicación seleccionada";
};

export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1); const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
};
const deg2rad = (deg) => deg * (Math.PI/180);

export const getRainText = (prob, mm, isSnow = false, temp = null) => {
    if (temp !== null && temp <= -5 && mm < 0.1) {
        if (temp <= -10) return "Frío polar";
        return "Ambiente gélido";
    }
    const noun = isSnow ? "Nieve" : "Lluvia";
    let text = noun;

    if (mm < 0.1) return `Sin ${noun.toLowerCase()} significativa`;

    if (isSnow) {
        if (mm < 0.5) text = "Nevada ligera";
        else if (mm < 2.0) text = "Nevada moderada";
        else text = "Nevada fuerte";
    } else {
        if (mm < 0.5) text = "Llovizna";
        else if (mm < 2.0) text = "Lluvia débil";
        else if (mm < 7.0) text = "Lluvia moderada";
        else text = "Lluvia intensa";
    }
    if (prob < 30) return `Posible ${text.toLowerCase()}`;
    if (prob < 70) return `Probable ${text.toLowerCase()}`;
    
    if (mm < 0.5 && !isSnow) return "Llovizna persistente";
    if (mm < 0.5 && isSnow) return "Copos sueltos";

    return `${text} asegurada`;
};

// ==========================================
// --- SISTEMA DE CACHÉ HISTÓRICO OPTIMIZADO ---
// ==========================================

// 1. GENERADOR DE CLAVES DE 10KM (Rounding)
// Redondea a 1 decimal. Ej: 40.41 -> 40.4. 
// Esto agrupa ubicaciones en celdas de ~11.1km.
export const getClimateKey = (lat, lon) => {
    const latK = parseFloat(lat).toFixed(1);
    const lonK = parseFloat(lon).toFixed(1);
    return `hist_v3_${latK}_${lonK}`;
};

// 2. DATABASE UTILS (INDEXED DB) - Sin dependencias externas
const DB_NAME = 'ClimaRetroDB';
const STORE_NAME = 'history_store';
const DB_VERSION = 1;

const openHistoryDB = () => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject("IndexedDB not supported");
            return;
        }
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Error opening DB");
        request.onsuccess = (e) => resolve(e.target.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME); // Key-Value simple
            }
        };
    });
};

export const getHistoryFromDB = async (key) => {
    try {
        const db = await openHistoryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => {
                const result = request.result;
                // Verificamos caducidad (30 días para datos históricos)
                if (result && result.expiry > Date.now()) {
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null); // Fallback suave
        });
    } catch (e) {
        console.warn("DB Read Error:", e);
        return null;
    }
};

export const saveHistoryToDB = async (key, data) => {
    try {
        const db = await openHistoryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            // Guardamos con caducidad de 30 días
            const item = { 
                data: data, 
                expiry: Date.now() + (1000 * 60 * 60 * 24 * 30) 
            };
            store.put(item, key);
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject("DB Write Error");
        });
    } catch (e) {
        console.warn("DB Write Error:", e);
    }
};

// MANTENEMOS COMPATIBILIDAD (Para caché ligera localStorage)
export const getCachedData = (key) => {
    try {
        const item = localStorage.getItem('climaretro_data_' + key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() > parsed.expiry) { localStorage.removeItem('climaretro_data_' + key); return null; }
        return parsed.data;
    } catch (e) { return null; }
};

export const setCachedData = (key, data) => {
    try {
        const item = { data: data, expiry: Date.now() + (1000 * 60 * 60 * 24) };
        localStorage.setItem('climaretro_data_' + key, JSON.stringify(item));
    } catch (e) { console.warn("LocalStorage full"); }
};