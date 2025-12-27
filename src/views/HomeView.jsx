import React, { useState, useEffect } from 'react';
import { 
    Sun, Moon, CloudSun, CloudMoon, CloudRain, CloudSnow, CloudLightning, Snowflake,
    Umbrella, Droplets, AlertCircle // AÑADIDO: AlertCircle
} from 'lucide-react';
import HomeSummary from '../components/HomeSummary';
import WeeklyForecast from '../components/WeeklyForecast';
import { getWeatherInfo } from '../utils/helpers';
import WeatherIconMain from '../components/ui/WeatherIconMain'; 

const getIconForCode = (code, isDay = 1) => {
    if (!isDay) {
        if (code === 0) return Moon; 
        if (code >= 1 && code <= 3) return CloudMoon; 
        if (code >= 45 && code <= 48) return CloudMoon; 
    }
    if (code === 0) return Sun;
    if (code >= 1 && code <= 3) return CloudSun; 
    if (code >= 45 && code <= 48) return CloudSun;
    
    if (code >= 71 && code <= 77) return Snowflake;
    if (code >= 85 && code <= 86) return Snowflake;
    
    if (code >= 51 && code <= 67) return CloudRain;
    if (code >= 80 && code <= 82) return CloudRain;
    if (code >= 95) return CloudLightning;
    return Sun;
};

const HomeView = ({ weatherData, favorites, onSelectActivity }) => {
    const [localTime, setLocalTime] = useState('');

    useEffect(() => {
        if (weatherData && weatherData.timezone) {
            const updateTime = () => {
                try {
                    const timeStr = new Date().toLocaleTimeString('es-ES', {
                        timeZone: weatherData.timezone,
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    setLocalTime(timeStr);
                } catch (e) { setLocalTime(''); }
            };
            updateTime();
            const interval = setInterval(updateTime, 60000);
            return () => clearInterval(interval);
        }
    }, [weatherData]);

    if (!weatherData) return null;

    const currentInfo = getWeatherInfo(weatherData.current.code);

    let { name, country } = weatherData.location;
    if (country && country.includes('/')) country = null; 
    if (!country && name.includes(',')) {
        const parts = name.split(',');
        country = parts.pop().trim();
        name = parts.join(',').trim();
    }

    // --- LÓGICA DE ALERTA SINTÉTICA (12h) ---
    const nextRainEvent = weatherData.analysis.hourlyForecast.slice(0, 12).find(h => h.prob >= 30);
    
    let AlertComponent = null;

    if (nextRainEvent) {
        const isSnow = nextRainEvent.snowCM > 0 || (nextRainEvent.iconCode >= 71);
        const WeatherIcon = isSnow ? Snowflake : Umbrella;
        
        // Estilos condicionales
        const colorClass = isSnow ? "text-cyan-200 bg-cyan-500/10 border-cyan-500/20" : "text-blue-200 bg-blue-500/10 border-blue-500/20";
        const iconColor = isSnow ? "text-cyan-400" : "text-blue-400";
        
        // Datos
        const timeLabel = nextRainEvent.time;
        const amountLabel = isSnow ? `${nextRainEvent.snowCM}cm` : `${nextRainEvent.mm}mm`;
        const probLabel = `${nextRainEvent.prob}%`;

        AlertComponent = (
            <div className={`mt-3 mb-1 inline-flex items-center gap-3 px-3 py-2 rounded-xl border backdrop-blur-md ${colorClass} animate-fade-in shadow-lg shadow-black/10`}>
                {/* ICONO DE ALERTA PULSANTE (NUEVO) */}
                <div className="flex items-center justify-center bg-white/10 p-1 rounded-full animate-pulse">
                    <AlertCircle size={14} className={iconColor} strokeWidth={3} />
                </div>

                {/* ICONO CLIMA + HORA */}
                <div className="flex items-center gap-1.5">
                    <WeatherIcon size={14} className="opacity-80" strokeWidth={2.5} />
                    <span className="text-xs font-bold tracking-wide">{timeLabel}</span>
                </div>

                <div className="w-px h-3 bg-current opacity-20"></div>

                {/* DATOS TÉCNICOS */}
                <div className="flex items-center gap-2 text-[10px] font-bold opacity-90">
                    <span className="flex items-center gap-0.5"><Droplets size={10} className="fill-current opacity-60"/>{amountLabel}</span>
                    <span className="opacity-40">•</span>
                    <span>{probLabel}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-3xl p-6 relative overflow-hidden animate-fade-in">
            {/* ENCABEZADO */}
            <div className="relative z-10 flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                    <h2 className="text-2xl font-bold leading-none mb-1 truncate">{name}</h2>
                    <div className="flex items-center gap-2 mb-4">
                        <p className="text-xs text-slate-400 uppercase font-bold tracking-widest truncate">{country || ""}</p>
                        {localTime && (
                            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-400/10 px-1.5 rounded">
                                {localTime}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                        <span className="text-7xl font-bold tracking-tighter text-white">{weatherData.current.temp}°</span>
                    </div>
                    <div className={`text-xl font-bold capitalize ${currentInfo.color} mt-1`}>{currentInfo.label}</div>
                    <span className="text-sm font-bold text-slate-500 block">
                        Sensación de {weatherData.current.feelsLike}°
                    </span>

                    {/* --- PÍLDORA CON ALERTA PULSANTE --- */}
                    {AlertComponent}

                    <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <Sun size={24} className="text-orange-400" strokeWidth={2} />
                            <span className="text-sm font-bold text-slate-200">{weatherData.astro.sunrise}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Moon size={24} className="text-purple-400" strokeWidth={2} />
                            <span className="text-sm font-bold text-slate-200">{weatherData.astro.sunset}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-slate-300">
                                <Moon size={20} fill="currentColor" className="opacity-50" strokeWidth={0} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[80px]">
                                {weatherData.astro.moonPhase}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="-mt-6 -mr-6 shrink-0 pointer-events-none relative z-0">
                    <WeatherIconMain 
                        code={weatherData.current.code} 
                        isDay={weatherData.current.isDay} 
                        temp={weatherData.current.temp}
                        className="w-40 h-40" 
                    />
                </div>
            </div>

            <div className="h-px bg-white/5 w-full my-6"></div>

            <div className="relative z-10">
                <HomeSummary 
                    weatherData={weatherData} 
                    onSelectActivity={onSelectActivity} 
                    favorites={favorites} 
                />
            </div>

            <div className="mt-6">
                <div className="flex gap-3 overflow-x-auto pb-4 px-1 no-scrollbar relative z-10 snap-x snap-mandatory">
                    {weatherData.analysis.hourlyForecast.map((h, i) => {
                        const Icon = getIconForCode(h.iconCode, h.isDay); 
                        
                        const isSnow = h.snowCM > 0 || (h.iconCode >= 71 && h.iconCode <= 77) || (h.iconCode >= 85 && h.iconCode <= 86);
                        const barColor = isSnow ? 'bg-cyan-300' : 'bg-blue-500';
                        const textColor = isSnow ? 'text-cyan-300' : 'text-blue-400';

                        let iconColor = "text-slate-200";
                        if (h.prob >= 30) {
                             if (isSnow) iconColor = "text-cyan-200";
                             else iconColor = "text-blue-300";
                        } else if (!h.isDay) {
                             iconColor = "text-slate-400";
                        } else {
                             iconColor = "text-amber-200";
                        }

                        const barHeight = Math.min((isSnow ? h.snowCM * 4 : h.mm * 4) + 4, 12);

                        return (
                            <div key={i} className="flex flex-col items-center min-w-[3.5rem] gap-1 snap-center">
                                <span className="text-[10px] text-slate-500 font-bold mb-1">{h.time}</span>
                                <Icon className={`w-6 h-6 ${iconColor}`} />
                                <span className="text-sm font-bold text-white mb-1">{h.temp}°</span>
                                
                                <div className="h-6 w-full flex items-end justify-center">
                                    {h.prob > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5 animate-fade-in">
                                            <span className={`text-[9px] font-bold leading-none ${textColor}`}>{h.prob}%</span>
                                            <div className={`w-1 rounded-full ${barColor}`} style={{ height: `${barHeight}px` }}></div>
                                        </div>
                                    ) : (
                                        <div className="w-1 h-1 rounded-full bg-slate-800/50 mb-1"></div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="mt-2">
                <WeeklyForecast daily={weatherData.daily} hourly={weatherData.rawHourly} />
            </div>
        </div>
    );
};

export default HomeView;