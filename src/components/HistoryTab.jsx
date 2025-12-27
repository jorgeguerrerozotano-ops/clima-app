import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { History, Save, Activity, AlertCircle, Thermometer, Droplets, TrendingUp, TrendingDown, CloudRain } from 'lucide-react';
import LocationSearchInput from './LocationSearchInput'; 
import { 
    getHistoryFromDB, 
    saveHistoryToDB, 
    calculateClimateTrends, 
    getClimateKey 
} from '../utils/helpers';

const HistoryTab = ({ initialLat, initialLon, initialCity, onOpenMap, mapUpdate, onGPS }) => {
    const [currentWeek, setCurrentWeek] = useState(getWeekNumber(new Date()));
    
    const [fullRawData, setFullRawData] = useState(null); 
    const [chartData, setChartData] = useState([]);
    const [trends, setTrends] = useState(null); 
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null); 
    const [usingCache, setUsingCache] = useState(false);
    
    // Estado local para la búsqueda
    const [localLoc, setLocalLoc] = useState({ lat: initialLat, lon: initialLon, name: initialCity });
    const [searchInput, setSearchInput] = useState(initialCity);

    // Sincronizar con props externas (Mapa/Init)
    useEffect(() => {
        if (mapUpdate) {
            setLocalLoc(mapUpdate);
            setSearchInput(mapUpdate.name);
        }
    }, [mapUpdate]);

    useEffect(() => {
        if (!searchInput && initialLat && initialLon) {
            setLocalLoc({ lat: initialLat, lon: initialLon, name: initialCity });
            setSearchInput(initialCity);
        }
    }, [initialLat, initialLon, initialCity]);

    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    }

    const getWeekRange = (weekNo) => {
        const curr = new Date();
        const year = curr.getFullYear();
        const requiredDate = new Date(year, 0, 1 + (weekNo - 1) * 7);
        const startMonth = requiredDate.toLocaleString('es-ES', { month: 'short' });
        const startDay = requiredDate.getDate();
        const endDate = new Date(requiredDate);
        endDate.setDate(endDate.getDate() + 6);
        const endMonth = endDate.toLocaleString('es-ES', { month: 'short' });
        const endDay = endDate.getDate();
        return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    };

    const handleLocalSelect = (item) => {
        if (!item) return;
        setSearchInput(item.name);
        setLocalLoc({ lat: item.lat, lon: item.lon, name: item.name });
    };

    // --- EFECTO 1: DESCARGA OPTIMIZADA (DB + ABORT CONTROLLER) ---
    useEffect(() => {
        // Controlador de cancelación para peticiones obsoletas
        const abortController = new AbortController();
        const signal = abortController.signal;

        const fetchHistory = async () => {
            if (!localLoc.lat || !localLoc.lon) return;

            // 1. GENERACIÓN DE CLAVE OPTIMIZADA (Radio 10km)
            const cacheKey = getClimateKey(localLoc.lat, localLoc.lon);

            setLoading(true); 
            setError(null); 
            setUsingCache(false);
            setChartData([]);

            try {
                // 2. INTENTO DE LECTURA ASÍNCRONA (INDEXED DB)
                // Esto no bloquea la UI aunque sean MBs de datos
                const cached = await getHistoryFromDB(cacheKey);
                
                if (signal.aborted) return; // Si el usuario cambió de ciudad mientras leíamos

                if (cached) {
                    setFullRawData(cached);
                    setUsingCache(true);
                    setLoading(false);
                    return;
                }

                // 3. DESCARGA DESDE LA API (Solo si no hay caché)
                // Mantenemos 1950 como pediste
                const endDate = new Date().toISOString().split('T')[0];
                const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${localLoc.lat}&longitude=${localLoc.lon}&start_date=1950-01-01&end_date=${endDate}&daily=temperature_2m_mean,precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`;
                
                const res = await fetch(url, { signal }); // Pasamos signal
                
                if (res.status === 429) throw new Error("API_LIMIT");
                if (!res.ok) throw new Error("Error de conexión");
                
                const data = await res.json();
                
                if (!data || !data.daily) throw new Error("Datos incompletos");

                if (signal.aborted) return;

                // 4. GUARDADO ASÍNCRONO (INDEXED DB)
                setFullRawData(data.daily);
                await saveHistoryToDB(cacheKey, data.daily);

            } catch (e) {
                if (e.name === 'AbortError') {
                    // Ignoramos errores por cancelación manual
                    console.log("Petición cancelada");
                } else {
                    console.error("Error historial:", e);
                    if (e.message === "API_LIMIT") setError("API_LIMIT");
                    else if (e.message === "Datos incompletos") setError("Datos no disponibles para esta zona");
                    else setError("Error de conexión");
                }
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        };

        fetchHistory();

        // CLEANUP FUNCTION: Cancela la petición si el componente se desmonta o cambian las coords
        return () => {
            abortController.abort();
        };

    }, [localLoc.lat, localLoc.lon]); // <--- Dependencias limpias

    // --- EFECTO 2: PROCESAMIENTO DE DATOS (Instantáneo en memoria) ---
    useEffect(() => {
        if (!fullRawData || !fullRawData.time) return;

        try {
            const rawData = fullRawData;
            const yearsMap = new Map();
            
            // Recorremos el array gigante (muy rápido en JS moderno)
            rawData.time.forEach((dateStr, index) => {
                const date = new Date(dateStr);
                const year = date.getFullYear();
                const week = getWeekNumber(date);
                
                if (week === currentWeek) {
                    if (!yearsMap.has(year)) {
                        yearsMap.set(year, { temps: [], precips: [], maxs: [], mins: [] });
                    }
                    const entry = yearsMap.get(year);
                    
                    if (rawData.temperature_2m_mean[index] != null) entry.temps.push(rawData.temperature_2m_mean[index]);
                    if (rawData.precipitation_sum[index] != null) entry.precips.push(rawData.precipitation_sum[index]);
                    if (rawData.temperature_2m_max[index] != null) entry.maxs.push(rawData.temperature_2m_max[index]);
                    if (rawData.temperature_2m_min[index] != null) entry.mins.push(rawData.temperature_2m_min[index]);
                }
            });
            
            const result = [];
            Array.from(yearsMap.keys()).sort().forEach(year => {
                const d = yearsMap.get(year);
                if (d.temps.length > 0) {
                    const avgMean = d.temps.reduce((a, b) => a + b, 0) / d.temps.length;
                    const sumRain = d.precips.reduce((a, b) => a + b, 0); 
                    const avgMax = d.maxs.reduce((a, b) => a + b, 0) / d.maxs.length;
                    const avgMin = d.mins.reduce((a, b) => a + b, 0) / d.mins.length;

                    result.push({
                        year,
                        avgTemp: parseFloat(avgMean.toFixed(1)),
                        totalRain: parseFloat(sumRain.toFixed(1)),
                        meanMax: parseFloat(avgMax.toFixed(1)),
                        meanMin: parseFloat(avgMin.toFixed(1))
                    });
                }
            });
            
            setChartData(result);
            setTrends(calculateClimateTrends(result));

        } catch(e) {
            console.error("Error procesando datos locales", e);
        }

    }, [fullRawData, currentWeek]);

    const getTempColor = (temp) => {
        const t = Math.max(-10, Math.min(40, temp));
        const minHue = 0; const maxHue = 220;
        const ratio = (t - -10) / (35 - -10);
        const hue = maxHue - (ratio * (maxHue - minHue));
        return `hsl(${hue}, 75%, 60%)`;
    };

    const TempTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs z-50">
                    <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">Año {label}</p>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Media:</span>
                            <span className="font-mono font-bold text-white">{data.avgTemp}°</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Máx:</span>
                            <span className="font-mono font-bold text-red-300">{data.meanMax}°</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Mín:</span>
                            <span className="font-mono font-bold text-blue-300">{data.meanMin}°</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const RainTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            let labelRain = "Seco";
            if (data.totalRain > 0.1) labelRain = "Llovizna";
            if (data.totalRain > 5) labelRain = "Lluvia";
            if (data.totalRain > 20) labelRain = "Intenso";
            if (data.totalRain > 50) labelRain = "Torrencial";

            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs z-50">
                    <p className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">Año {label}</p>
                    <div className="flex justify-between gap-4">
                        <span className="text-blue-300 font-bold">{data.totalRain} mm</span>
                        <span className="text-slate-400 opacity-80">{labelRain}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="animate-fade-in space-y-4 pb-24">
            <div className="glass-panel p-4 rounded-2xl">
                
                {/* 1. BUSCADOR SIEMPRE ARRIBA */}
                <div className="mb-4">
                    <LocationSearchInput 
                        placeholder="Buscar zona histórica..."
                        initialValue={searchInput}
                        proximityCoords={localLoc}
                        onSelect={handleLocalSelect}
                        onGPS={onGPS}
                        onMapClick={onOpenMap}
                    />
                </div>

                {/* SELECTOR DE SEMANA */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-baseline">
                        <h2 className="text-xl font-bold text-white truncate w-2/3">{localLoc.name}</h2>
                        {usingCache && <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 animate-pulse"><Save className="w-3 h-3"/> DB</span>}
                    </div>
                    <select 
                        value={currentWeek} 
                        onChange={(e) => setCurrentWeek(parseInt(e.target.value))} 
                        className="w-full bg-slate-800 border border-slate-600 text-xs text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                    >
                        {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                            <option key={w} value={w}>Semana {w} ({getWeekRange(w)})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ESTADOS DE CARGA Y ERROR */}
            {loading ? (
                <div className="p-10 flex flex-col items-center text-slate-400">
                    <Activity className="w-8 h-8 animate-spin mb-2" />
                    <span>Analizando 80 años de datos...</span>
                    <span className="text-[10px] mt-2 opacity-50">Esto solo tarda la primera vez</span>
                </div>

            ) : error ? (
                <div className="bg-slate-800 border border-slate-600 text-slate-300 p-6 rounded-2xl flex flex-col items-center text-center gap-3 animate-fade-in mx-4">
                    <div className="bg-slate-700 p-3 rounded-full">
                        <AlertCircle size={24} className="text-slate-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white mb-1">
                            {error === "API_LIMIT" ? "Límite de servicio alcanzado" : "Datos no disponibles"}
                        </p>
                        <p className="text-xs opacity-70 leading-relaxed">
                            {error === "API_LIMIT" 
                                ? "El servidor de datos históricos está saturado en este momento. Por favor, inténtelo de nuevo más tarde." 
                                : "No hemos podido recuperar los registros históricos para esta ubicación exacta."}
                        </p>
                    </div>
                </div>

            ) : trends && chartData.length > 0 ? (
                <>
                    {/* TÍTULO DE SECCIÓN + SUMARIO */}
                    <div className="px-1 mb-2">
                        <div className="flex items-center gap-2 text-indigo-400 mb-2">
                            <History className="w-5 h-5" />
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest leading-none">Análisis Climático</h3>
                                <p className="text-[10px] text-slate-400 font-medium normal-case opacity-80">
                                    Medias históricas registradas desde 1950 hasta hoy
                                </p>
                            </div>
                        </div>

                        {/* SUMARIO TÉCNICO (GRID 2x2 LIMPIO) */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <div className="bg-slate-800/60 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                                <span className="text-[9px] text-slate-400 uppercase font-bold mb-1">Rango Térmico</span>
                                <div className="flex items-center gap-1.5 text-xl font-black text-white tracking-tight">
                                    <span className="text-blue-200">{trends.avgMinGlobal}°</span>
                                    <span className="text-slate-600 text-sm">↔</span>
                                    <span className="text-orange-200">{trends.avgMaxGlobal}°</span>
                                </div>
                                <span className="text-[9px] text-slate-500 mt-1 font-medium">Mín • Máx</span>
                            </div>
                            
                            <div className="bg-slate-800/60 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                                <span className="text-[9px] text-slate-400 uppercase font-bold mb-1">Probabilidad Lluvia</span>
                                <div className="flex items-center gap-1 text-xl font-black text-white tracking-tight">
                                    <CloudRain size={18} className="text-blue-400 mb-0.5"/>
                                    <span>{trends.rainProbValue}%</span>
                                </div>
                                <span className={`text-[9px] font-bold mt-1 ${trends.rainProbText === 'Alta' || trends.rainProbText === 'Muy Alta' ? 'text-blue-300' : 'text-slate-500'}`}>
                                    {trends.rainProbText}
                                </span>
                            </div>

                            <div className="bg-slate-800/60 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                                <span className="text-[9px] text-slate-400 uppercase font-bold mb-1">Evolución Temp.</span>
                                <div className={`flex items-center gap-1 text-xl font-black tracking-tight ${parseFloat(trends.tempDelta) > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                    {parseFloat(trends.tempDelta) > 0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
                                    <span>{parseFloat(trends.tempDelta) > 0 ? '+' : ''}{trends.tempDelta}°</span>
                                </div>
                            </div>

                            <div className="bg-slate-800/60 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                                <span className="text-[9px] text-slate-400 uppercase font-bold mb-1">Evolución Lluvia</span>
                                <div className={`flex items-center gap-1 text-xl font-black tracking-tight ${parseFloat(trends.rainDelta) < 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                                    {parseFloat(trends.rainDelta) > 0 ? '+' : ''}{trends.rainDelta}
                                    <span className="text-xs font-bold opacity-70 ml-0.5">mm</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GRÁFICO 1: TEMPERATURA */}
                    <div className="glass-panel rounded-xl p-4">
                        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                            <Thermometer className="w-3 h-3 text-red-400"/> Registro Histórico (Temp)
                        </h3>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{top: 5, right: 0, left: -20, bottom: 0}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke='#334155' opacity={0.5} />
                                    <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={20} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                                    <Tooltip content={<TempTooltip />} cursor={{ fill: '#334155', opacity: 0.2 }} />
                                    <Bar dataKey="avgTemp">
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getTempColor(entry.avgTemp)} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* GRÁFICO 2: PRECIPITACIÓN */}
                    <div className="glass-panel rounded-xl p-4">
                        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                            <Droplets className="w-3 h-3 text-blue-400"/> Lluvia Histórica
                        </h3>
                        <div className="h-24 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{top: 5, right: 0, left: -20, bottom: 0}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke='#334155' opacity={0.5} />
                                    <XAxis dataKey="year" hide />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<RainTooltip />} cursor={{ fill: '#334155', opacity: 0.2 }} />
                                    <Bar dataKey="totalRain" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center text-slate-500 p-10 text-xs">
                    Selecciona una ubicación para ver su historia.
                </div>
            )}
        </div>
    );
};

export default HistoryTab;