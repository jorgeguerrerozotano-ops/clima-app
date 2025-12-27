import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronDown, ChevronUp, Droplets, Wind, Snowflake, // IMPORTAMOS SNOWFLAKE
    Sun, Moon, CloudRain, CloudSnow, CloudLightning,
    CloudSun, CloudMoon 
} from 'lucide-react';

const getForecastIcon = (code, isDay = 1) => {
    if (!isDay) {
        if (code === 0) return Moon; 
        if (code >= 1 && code <= 3) return CloudMoon; 
        if (code >= 45 && code <= 48) return CloudMoon; 
    }
    if (code === 0) return Sun;
    if (code >= 1 && code <= 3) return CloudSun; 
    if (code >= 45 && code <= 48) return CloudSun;
    
    // Para nieve usamos CloudSnow en el icono principal del día
    if (code >= 71 && code <= 77) return CloudSnow;
    if (code >= 85 && code <= 86) return CloudSnow;
    
    if (code >= 51 && code <= 67) return CloudRain;
    if (code >= 80 && code <= 82) return CloudRain;
    if (code >= 95) return CloudLightning;
    return Sun;
};

const WeeklyForecast = ({ daily, hourly }) => {
    const [isSectionOpen, setIsSectionOpen] = useState(false);
    const [expandedDay, setExpandedDay] = useState(null);
    
    const containerRef = useRef(null);

    useEffect(() => {
        if (isSectionOpen && containerRef.current) {
            setTimeout(() => {
                containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        }
    }, [isSectionOpen]);

    if (!daily || !daily.time || !hourly) return null;

    // --- LOGICA PERIODOS ---
    const getPeriodData = (dayIndex, startHour, endHour) => {
        const baseIndex = dayIndex * 24;
        if (baseIndex + endHour >= hourly.time.length) return { temp: '--', rainProb: 0, wind: 0, code: 0, snowSum: 0 };

        const sliceIndices = Array.from({ length: endHour - startHour }, (_, i) => baseIndex + startHour + i);
        let maxTemp = -99, maxRainProb = 0, maxWind = 0, weatherCodes = [], snowSum = 0;
        
        sliceIndices.forEach(idx => {
            if (hourly.temperature_2m[idx] > maxTemp) maxTemp = hourly.temperature_2m[idx];
            if (hourly.precipitation_probability[idx] > maxRainProb) maxRainProb = hourly.precipitation_probability[idx];
            if (hourly.wind_speed_10m[idx] > maxWind) maxWind = hourly.wind_speed_10m[idx];
            if (hourly.snowfall && hourly.snowfall[idx] > 0) snowSum += hourly.snowfall[idx]; // Sumamos nieve
            weatherCodes.push(hourly.weather_code[idx]);
        });
        
        const code = weatherCodes.sort((a,b) => weatherCodes.filter(v => v===a).length - weatherCodes.filter(v => v===b).length).pop() || 0;
        
        return { temp: Math.round(maxTemp), rainProb: maxRainProb, wind: Math.round(maxWind), code: code, snowSum };
    };

    // --- LOGICA HORARIA DETALLADA ---
    const getHourlyForDay = (dayIndex) => {
        const startIndex = dayIndex * 24;
        const endIndex = startIndex + 24;
        if (startIndex >= hourly.time.length) return [];
        const daySlice = hourly.time.slice(startIndex, endIndex);
        
        return daySlice.map((t, i) => {
            const actualIndex = startIndex + i;
            if (actualIndex >= hourly.time.length) return null;
            return {
                time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                temp: Math.round(hourly.temperature_2m[actualIndex]),
                iconCode: hourly.weather_code[actualIndex],
                isDay: hourly.is_day[actualIndex],
                rainProb: hourly.precipitation_probability[actualIndex],
                rainMM: hourly.precipitation[actualIndex],
                snowCM: hourly.snowfall ? hourly.snowfall[actualIndex] : 0 // Dato nieve
            };
        }).filter(Boolean);
    };

    const days = daily.time.slice(1, 7).map((dateStr, i) => {
        const realIndex = i + 1;
        const date = new Date(dateStr);
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayNum = date.getDate();
        const min = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[realIndex]) : '--';
        const max = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[realIndex]) : '--';

        return {
            realIndex: realIndex,
            dateDisplay: `${dayName} ${dayNum}`,
            min: min, max: max,
            morning: getPeriodData(realIndex, 8, 14),
            afternoon: getPeriodData(realIndex, 14, 20),
            night: getPeriodData(realIndex, 20, 23),
        };
    });

    const PeriodDetail = ({ label, icon: Icon, data }) => {
        const isDayParam = label === 'Noche' ? 0 : 1;
        const WIcon = getForecastIcon(data.code, isDayParam);
        
        // ¿Es nieve dominante?
        const isSnow = data.snowSum > 0 || (data.code >= 71 && data.code <= 77) || (data.code >= 85 && data.code <= 86);
        const PrecipIcon = isSnow ? Snowflake : Droplets;
        const precipColor = isSnow ? 'text-cyan-300' : 'text-blue-400';

        return (
            <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg mb-1 last:mb-0">
                <div className="flex items-center gap-3 w-1/3">
                    <Icon size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">{label}</span>
                </div>
                <div className="flex items-center gap-2 w-1/3 justify-center">
                    <WIcon size={16} className="text-white" />
                    <span className="text-xs font-bold">{data.temp}°</span>
                </div>
                <div className="flex items-center gap-3 w-1/3 justify-end text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><PrecipIcon size={10} className={precipColor}/> {data.rainProb}%</span>
                    <span className="flex items-center gap-1"><Wind size={10}/> {data.wind}</span>
                </div>
            </div>
        );
    };

    return (
        <div ref={containerRef} className="glass-panel rounded-2xl p-1 mt-4 animate-fade-in mb-6 overflow-hidden transition-all duration-500">
            <button onClick={() => setIsSectionOpen(!isSectionOpen)} className="w-full flex items-center justify-between p-4 bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Próximos Días</h3>
                {isSectionOpen ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
            </button>
            
            {isSectionOpen && (
                <div className="flex flex-col gap-2 p-4 pt-2 border-t border-white/5 animate-fade-in">
                    {days.map((day, idx) => {
                        const isExpanded = expandedDay === idx;
                        const MIcon = getForecastIcon(day.morning.code, 1);
                        const AIcon = getForecastIcon(day.afternoon.code, 1);
                        const NIcon = getForecastIcon(day.night.code, 0);
                        const hourlyData = isExpanded ? getHourlyForDay(day.realIndex) : [];

                        return (
                            <div key={idx} className="bg-slate-900/40 border border-slate-700/50 rounded-xl overflow-hidden transition-all">
                                <button onClick={() => setExpandedDay(isExpanded ? null : idx)} className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors cursor-pointer">
                                    <div className="w-24 text-left"><span className="text-xs font-bold text-white capitalize">{day.dateDisplay}</span></div>
                                    <div className="flex gap-3 text-slate-400"><MIcon size={14} /><AIcon size={14} /><NIcon size={14} /></div>
                                    <div className="flex items-center gap-3 w-24 justify-end">
                                        <span className="text-xs font-bold text-slate-300"><span className="text-blue-300">{day.min}°</span> / <span className="text-orange-300">{day.max}°</span></span>
                                        {isExpanded ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-slate-800/50 animate-fade-in bg-slate-950/30">
                                        {/* CARRUSEL HORARIO CON BARRAS INTELIGENTES */}
                                        <div className="py-4 px-2">
                                            <div className="flex overflow-x-auto gap-3 pb-2 px-2 no-scrollbar snap-x snap-mandatory">
                                                {hourlyData.map((h, hIdx) => {
                                                    const HIcon = getForecastIcon(h.iconCode, h.isDay);
                                                    
                                                    // DETECTAR NIEVE VS LLUVIA PARA ESTA HORA
                                                    const isSnow = h.snowCM > 0 || (h.iconCode >= 71 && h.iconCode <= 77) || (h.iconCode >= 85 && h.iconCode <= 86);
                                                    const barColor = isSnow ? 'bg-cyan-300' : 'bg-blue-500';
                                                    const textColor = isSnow ? 'text-cyan-300' : 'text-blue-400';
                                                    
                                                    return (
                                                        <div key={hIdx} className="flex flex-col items-center min-w-[3.5rem] snap-center">
                                                            <span className="text-[10px] text-slate-500 font-bold mb-1">{h.time}</span>
                                                            <HIcon size={20} className="text-slate-200 mb-1" />
                                                            <span className="text-sm font-bold text-white">{h.temp}°</span>
                                                            
                                                            <div className="h-4 mt-1 flex items-end">
                                                                {h.rainProb > 0 ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <span className={`text-[9px] font-bold ${textColor}`}>{h.rainProb}%</span>
                                                                        <div className={`w-1 rounded-full ${barColor}`} style={{ height: `${Math.min((isSnow ? h.snowCM * 4 : h.rainMM * 4) + 4, 12)}px` }}></div>
                                                                    </div>
                                                                ) : (<div className="w-1 h-1 rounded-full bg-slate-800"></div>)}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div className="p-3 pt-0">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Resumen del día</p>
                                            <PeriodDetail label="Mañana" icon={Sun} data={day.morning} />
                                            <PeriodDetail label="Tarde" icon={Sun} data={day.afternoon} />
                                            <PeriodDetail label="Noche" icon={Moon} data={day.night} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WeeklyForecast;