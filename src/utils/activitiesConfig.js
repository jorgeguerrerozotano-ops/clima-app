// src/utils/activitiesConfig.js
// V8.1 - FINAL TUNING (RANGOS EXTENDIDOS + VISIBILIDAD REACTIVA)

import { getRainText } from './helpers';

// 1. IMPORTAMOS ICONOS TÉCNICOS (LUCIDE)
import { 
    Thermometer as LucideThermometer, 
    Wind as LucideWind, 
    CloudRain as LucideCloudRain, 
    Droplets as LucideDroplets,
    Snowflake as LucideSnowflake,
    Mountain as LucideMountain,
    CloudFog as LucideCloudFog,
    Footprints as LucideFootprints
} from 'lucide-react';

// 2. IMPORTAMOS ICONOS DE ACTIVIDAD (PHOSPHOR)
import { 
    Motorcycle, Car, Bicycle, Bus, Train, Airplane, Boat, 
    PersonSimpleRun, PersonSimpleWalk, Barbell, SwimmingPool, TennisBall, SoccerBall, Basketball, YinYang, Footprints,
    House, Briefcase, GraduationCap, ShoppingCart, TShirt, Baby, PawPrint,
    Coffee, Pizza, BeerBottle, Wine, Popcorn, MusicNotes, GameController, BookOpen, Camera, PaintBrush,
    Plant, Sun, Fire, Gift, Heart, Star, Confetti,
    Wrench, Desktop, FirstAid
} from '@phosphor-icons/react';

export const AVAILABLE_ICONS = {
    'run': PersonSimpleRun, 'walk': PersonSimpleWalk, 'bike': Bicycle, 'moto': Motorcycle, 'car': Car, 'gym': Barbell,
    'swim': SwimmingPool, 'tennis': TennisBall, 'soccer': SoccerBall, 'basket': Basketball, 'yoga': YinYang, 'hike': Footprints,
    'bus': Bus, 'train': Train, 'fly': Airplane, 'boat': Boat,
    'work': Briefcase, 'study': GraduationCap, 'home': House, 'shop': ShoppingCart, 'laundry': TShirt, 'dog': PawPrint, 'baby': Baby,
    'coffee': Coffee, 'eat': Pizza, 'drink': BeerBottle, 'wine': Wine, 'cinema': Popcorn, 'music': MusicNotes, 'game': GameController, 'read': BookOpen, 'photo': Camera, 'art': PaintBrush,
    'garden': Plant, 'beach': Sun, 'camp': Fire, 'party': Confetti, 'gift': Gift, 'love': Heart, 'star': Star, 'health': FirstAid, 'fix': Wrench, 'pc': Desktop
};

export const getIconComponent = (iconName) => AVAILABLE_ICONS[iconName] || Star;

// LÍMITES DE SEGURIDAD FÍSICA (HARD LIMITS)
const SAFETY_LIMITS = {
    HUMAN_MIN_TEMP: -5,
    HUMAN_MAX_TEMP: 40,
    MOTO_MIN_TEMP: 2,
    MOTO_MAX_WIND: 50,
    LAUNDRY_MAX_WIND: 50 // Ropa volando
};

export const PREDEFINED_ACTIVITIES = [
  {
    id: 'moto', label: 'Moto', durationLabel: '(30 min)', icon: 'moto', duration: 30, rules: { mode: 'moto' }
  },
  {
    // AJUSTE: tempMin bajado a 6ºC.
    // Esto significa que de 6ºC para arriba es VERDE. Por debajo de 6ºC entra el buffer AMARILLO.
    id: 'running', label: 'Running', durationLabel: '(45 min)', icon: 'run', duration: 45, rules: { mode: 'standard', rainMax: 0.5, tempMin: 6, tempMax: 25, windMax: 25 }
  },
  {
    id: 'laundry', label: 'Colada', durationLabel: '(12 horas)', icon: 'laundry', duration: 720, rules: { mode: 'laundry' }
  }
];

// --- GENERADOR DE INFORME FINAL ---
const generateReport = (criticals, warnings, factors) => {
    // 1. VETO (ROJO)
    if (criticals.length > 0) {
        const count = criticals.length;
        return { 
            status: 'red', 
            message: `${count} de 4 CONDICIONES FUERA DE RANGO`, 
            analysis: criticals.join(". ") + ".", 
            factors 
        };
    }

    // 2. ADVERTENCIA (AMARILLO)
    if (warnings.length > 0) {
        const count = warnings.length;
        return { 
            status: 'yellow', 
            message: `${count} de 4 ADVERTENCIAS`, 
            analysis: warnings.join(". ") + ".", 
            factors 
        };
    }

    // 3. IDEAL (VERDE)
    return { 
        status: 'green', 
        message: 'CONDICIONES IDEALES', 
        analysis: 'Los 4 parámetros están dentro del rango óptimo.', 
        factors 
    };
};

// ==========================================
// 1. EVALUADOR ESTÁNDAR (Running)
// ==========================================
const evaluateStandardActivity = (data, rules) => {
    const { temp, rainMM, snowCM, snowDepth, wind, rainProb, isSnow, isFloorWet } = data;
    let criticals = []; let warnings = [];

    const LIMIT_TEMP_MIN = rules.tempMin ?? 6; // Default a 6 si no existe
    const LIMIT_TEMP_MAX = rules.tempMax ?? 30;
    const LIMIT_RAIN = rules.rainMax ?? 0.5;
    const LIMIT_WIND = rules.windMax ?? 30;

    // --- FACTOR 1: TEMP ---
    let fTemp = { name: 'Temp', value: `${temp}°`, status: 'green', icon: LucideThermometer };
    
    // A. Límites de Seguridad (Veto Absoluto)
    if (temp < SAFETY_LIMITS.HUMAN_MIN_TEMP) { 
        fTemp.status = 'red'; 
        criticals.push(`Peligro Frío (${temp}°)`); 
    } 
    // B. Límite Usuario Inferior (Buffer de 5 grados)
    // Ahora: Si min es 6 -> < 1º es Rojo. De 1º a 6º es Amarillo.
    else if (temp < LIMIT_TEMP_MIN - 5) { 
        fTemp.status = 'red'; 
        criticals.push(`Muy Frío (${temp}°)`); 
    }
    // (Min - 5) a Min -> AMARILLO (Aviso)
    else if (temp < LIMIT_TEMP_MIN) {
        fTemp.status = 'yellow';
        warnings.push(`Frío intenso (${temp}°)`);
    }
    // C. Límite Usuario Superior
    else if (temp > LIMIT_TEMP_MAX + 5) { 
        fTemp.status = 'red'; 
        criticals.push(`Calor Extremo (${temp}°)`); 
    }
    else if (temp > LIMIT_TEMP_MAX) {
        fTemp.status = 'yellow';
        warnings.push(`Calor excesivo (${temp}°)`);
    }

    // --- FACTOR 2: PRECIPITACIÓN ---
    const pVal = isSnow ? snowCM : rainMM;
    const pName = isSnow ? 'Nieve' : 'Lluvia';
    const pUnit = isSnow ? 'cm' : 'mm';
    let fPrecip = { name: pName, value: `${pVal}${pUnit}`, status: 'green', icon: isSnow ? LucideSnowflake : LucideCloudRain };
    
    if (pVal > LIMIT_RAIN) { 
        fPrecip.status = 'red'; 
        criticals.push(`${pName} intensa`); 
    } else if (pVal > 0 || (rainProb > 40 && pVal === 0)) { 
        fPrecip.status = 'yellow'; 
        warnings.push(`Riesgo ${pName}`); 
    }

    // --- FACTOR 3: VIENTO ---
    let fWind = { name: 'Viento', value: `${wind} km/h`, status: 'green', icon: LucideWind };
    if (wind > LIMIT_WIND) { 
        fWind.status = 'red'; 
        criticals.push(`Viento fuerte`); 
    } else if (wind > (LIMIT_WIND * 0.7)) { 
        fWind.status = 'yellow'; 
        warnings.push(`Viento moderado`); 
    }

    // --- FACTOR 4: SUELO ---
    let fSoil = { name: 'Suelo', value: 'Seco', status: 'green', icon: LucideFootprints };
    
    if (snowDepth > 0) {
        fSoil.value = `Nieve ${Math.round(snowDepth*100)}cm`;
        fSoil.icon = LucideMountain;
        if (snowDepth > 0.05 && !isSnow) { 
            fSoil.status = 'red'; 
            criticals.push(`Nieve acumulada`); 
        } else { 
            fSoil.status = 'yellow'; 
            warnings.push(`Suelo nevado`); 
        }
    } else if (isFloorWet) {
        fSoil.value = 'Húmedo';
        if (rules.checkWetFloor) { 
            fSoil.status = 'yellow'; 
            warnings.push('Suelo mojado'); 
        }
    }

    return generateReport(criticals, warnings, [fTemp, fPrecip, fWind, fSoil]);
};

// ==========================================
// 2. EVALUADOR MOTO (Ajustado)
// ==========================================
const evaluateMotoActivity = (data, rules) => {
    const { temp, rainMM, snowCM, snowDepth, wind, isSnow, isFloorWet, code } = data;
    let criticals = []; let warnings = [];

    // --- F1: TEMP ---
    let fTemp = { name: 'Temp', value: `${temp}°`, status: 'green', icon: LucideThermometer };
    if (temp < SAFETY_LIMITS.MOTO_MIN_TEMP) { 
        fTemp.status = 'red'; 
        criticals.push(`Riesgo Hielo`); 
    }
    // AJUSTE: El aviso salta ahora por debajo de 6 grados (antes 10)
    else if (temp < 6) { 
        fTemp.status = 'yellow'; 
        warnings.push('Frío intenso'); 
    }

    // --- F2: VIENTO ---
    let fWind = { name: 'Viento', value: `${wind} km/h`, status: 'green', icon: LucideWind };
    if (wind > SAFETY_LIMITS.MOTO_MAX_WIND) { fWind.status = 'red'; criticals.push(`Viento peligroso`); }
    else if (wind > 30) { fWind.status = 'yellow'; warnings.push('Viento molesto'); }

    // --- F3: CALZADA ---
    let fRoad = { name: 'Calzada', value: 'Seca', status: 'green', icon: LucideCloudRain };
    if (snowDepth > 0) {
        fRoad.name = 'Nieve'; fRoad.value = `${Math.round(snowDepth*100)}cm`; fRoad.icon = LucideMountain;
        fRoad.status = 'red'; criticals.push('Nieve en vía');
    } else if (rainMM > 0.2 || isSnow) {
        fRoad.name = isSnow ? 'Nevando' : 'Lloviendo'; fRoad.value = isSnow ? `${snowCM}cm` : `${rainMM}mm`;
        fRoad.status = 'red'; criticals.push('Precipitación activa');
    } else if (isFloorWet) {
        fRoad.value = 'Húmeda'; fRoad.status = 'yellow'; warnings.push('Asfalto húmedo');
    }

    // --- F4: VISIBILIDAD (MEJORADA) ---
    // Ahora es más reactiva: no solo niebla, sino lluvia intensa o nieve
    let fVis = { name: 'Visib.', value: 'Buena', status: 'green', icon: LucideCloudFog };
    
    // Niebla oficial
    if (code === 45 || code === 48) {
        fVis.value = 'Niebla'; fVis.status = 'yellow'; warnings.push('Visibilidad reducida');
    } 
    // NUEVO: Lluvia moderada/fuerte (> 2mm) o Nieve también bajan visibilidad
    else if (rainMM > 2.0 || isSnow) {
        fVis.value = 'Regular'; 
        fVis.status = 'yellow';
        // No añadimos warning de texto extra para no duplicar el de lluvia, pero marcamos la caja amarilla
    }

    return generateReport(criticals, warnings, [fTemp, fWind, fRoad, fVis]);
};

// ==========================================
// 3. EVALUADOR COLADA
// ==========================================
const evaluateLaundryActivity = (data, hourlyData, startIndex) => {
    const { temp, isSnow, wind } = data;
    let criticals = []; let warnings = [];

    // --- F1: TEMP ---
    let fTemp = { name: 'Temp', value: `${temp}°`, status: 'green', icon: LucideThermometer };
    if (temp <= 0) { fTemp.status = 'red'; criticals.push('Congelación'); }

    // --- F2: LLUVIA (12h) ---
    let rainTotal = 0; let badHours = 0;
    const limit = Math.min(startIndex + 12, hourlyData.time.length);
    for (let i = startIndex; i < limit; i++) {
        if (hourlyData.precipitation[i] > 0) { badHours++; rainTotal += hourlyData.precipitation[i]; }
    }
    let fRain = { name: 'Lluvia', value: '0mm', status: 'green', icon: isSnow ? LucideSnowflake : LucideCloudRain };
    if (rainTotal > 0.5) { 
        fRain.value = `${rainTotal.toFixed(1)}mm`; fRain.status = 'red'; criticals.push('Lluvia prevista'); 
    } else if (badHours > 0) { 
        fRain.status = 'yellow'; warnings.push('Riesgo llovizna'); 
    }

    // --- F3: HUMEDAD ---
    const humidity = hourlyData.relative_humidity_2m[startIndex];
    let fHum = { name: 'Humedad', value: `${Math.round(humidity)}%`, status: 'green', icon: LucideDroplets };
    if (humidity > 85) { fHum.status = 'yellow'; warnings.push('Humedad alta'); }

    // --- F4: VIENTO (Lógica Contextual) ---
    let fWind = { name: 'Viento', value: `${wind} km/h`, status: 'green', icon: LucideWind };
    
    if (wind > SAFETY_LIMITS.LAUNDRY_MAX_WIND) {
        fWind.status = 'red';
        criticals.push('Riesgo ropa volando');
    } 
    else if (wind > 40) {
        fWind.status = 'yellow';
        warnings.push('Viento excesivo');
    } 
    // ESTANCAMIENTO: Solo si hay poco viento Y mucha humedad
    else if (wind < 10 && humidity > 70) {
        fWind.value = 'Estancado'; 
        fWind.status = 'yellow';
        warnings.push('Aire húmedo estancado');
    } 
    else if (wind < 5) {
        fWind.value = 'Calma'; 
        fWind.status = 'green';
    }

    return generateReport(criticals, warnings, [fTemp, fRain, fHum, fWind]);
};

// ==========================================
// FUNCIÓN PRINCIPAL
// ==========================================
export const checkActivityRules = (hourlyData, startIndex, durationMinutes, rules) => {
    if (!hourlyData || !hourlyData.time || startIndex >= hourlyData.time.length) {
        return { 
            status: 'gray', 
            message: 'SIN DATOS', 
            analysis: 'Información no disponible.', 
            factors: [
                { name: 'Data', value: '--', status: 'gray', icon: LucideThermometer },
                { name: 'Data', value: '--', status: 'gray', icon: LucideThermometer },
                { name: 'Data', value: '--', status: 'gray', icon: LucideThermometer },
                { name: 'Data', value: '--', status: 'gray', icon: LucideThermometer }
            ] 
        };
    }

    const i = startIndex;
    const temp = Math.round(hourlyData.temperature_2m[i]);
    const rainProb = hourlyData.precipitation_probability[i];
    const rainMM = hourlyData.precipitation[i]; 
    const snowCM = hourlyData.snowfall ? hourlyData.snowfall[i] : 0; 
    const snowDepth = hourlyData.snow_depth ? hourlyData.snow_depth[i] : 0; 
    const wind = Math.round(hourlyData.wind_speed_10m[i]);
    const code = hourlyData.weather_code[i]; 
    const humidity = hourlyData.relative_humidity_2m[i];
    
    const isSnow = snowCM > 0 || (temp < 2 && rainMM > 0);
    const isFloorWet = (startIndex >= 2) 
        ? hourlyData.precipitation.slice(startIndex - 2, startIndex).reduce((a, b) => a + b, 0) > 0.5 
        : false;

    const analysisData = { temp, rainMM, snowCM, snowDepth, wind, rainProb, isSnow, isFloorWet, code, humidity };

    try {
        if (rules.mode === 'moto') return evaluateMotoActivity(analysisData, rules);
        if (rules.mode === 'laundry') return evaluateLaundryActivity(analysisData, hourlyData, startIndex);
        return evaluateStandardActivity(analysisData, rules);
    } catch (e) {
        console.error("Rules Error:", e);
        return { status: 'gray', message: 'ERROR', analysis: 'Fallo interno.', factors: [] };
    }
};